<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class SVP_API_Client {

    /**
     * Make an authenticated POST request to the Saudi VAT Pro API.
     *
     * @param string $endpoint  Relative API path, e.g. '/api/v1/woocommerce/webhook/TOKEN'
     * @param array  $body      Data to send as JSON.
     * @return array|WP_Error   Parsed response body, or WP_Error on failure.
     */
    public static function post( $endpoint, $body ) {
        $api_key     = get_option( 'svp_api_key', '' );
        $webhook_url = get_option( 'svp_webhook_url', '' );

        if ( empty( $api_key ) || empty( $webhook_url ) ) {
            return new WP_Error( 'svp_not_configured', 'Saudi VAT Pro API key or webhook URL is not configured.' );
        }

        $url = rtrim( $webhook_url, '/' ) . $endpoint;

        $response = wp_remote_post( $url, [
            'headers' => [
                'Content-Type'  => 'application/json',
                'Authorization' => 'Bearer ' . $api_key,
                'X-SVP-Source'  => 'woocommerce/' . SVP_WC_VERSION,
            ],
            'body'        => wp_json_encode( $body ),
            'timeout'     => 15,
            'data_format' => 'body',
        ] );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        $code = wp_remote_retrieve_response_code( $response );
        $raw  = wp_remote_retrieve_body( $response );
        $data = json_decode( $raw, true );

        if ( $code >= 400 ) {
            $msg = isset( $data['message'] ) ? $data['message'] : "HTTP {$code}";
            return new WP_Error( 'svp_api_error', $msg );
        }

        return $data ?? [];
    }

    /**
     * Push a WooCommerce order payload to Saudi VAT Pro.
     * The webhook URL already contains the auth token; we just POST the order.
     *
     * @param WC_Order $order
     * @return array|WP_Error
     */
    public static function push_order( $order ) {
        $payload = self::build_order_payload( $order );
        $webhook_url = get_option( 'svp_webhook_url', '' );

        if ( empty( $webhook_url ) ) {
            return new WP_Error( 'svp_not_configured', 'Webhook URL not set.' );
        }

        $secret = get_option( 'svp_webhook_secret', '' );
        $body   = wp_json_encode( $payload );

        $headers = [
            'Content-Type'          => 'application/json',
            'X-WC-Webhook-Topic'    => 'order.updated',
            'X-WC-Webhook-Source'   => get_site_url(),
            'X-WC-Webhook-Resource' => 'order',
            'X-WC-Webhook-Event'    => 'updated',
            // Ask the server to process synchronously and return invoiceId + pdfUrl
            // so we can persist them on the WC order for My Account / email links.
            'X-SVP-Return-Invoice'  => '1',
        ];

        if ( $secret ) {
            $headers['X-WC-Webhook-Signature'] = base64_encode( hash_hmac( 'sha256', $body, $secret, true ) );
        }

        $response = wp_remote_post( $webhook_url, [
            'headers'     => $headers,
            'body'        => $body,
            'timeout'     => 30,
            'data_format' => 'body',
        ] );

        return is_wp_error( $response ) ? $response : json_decode( wp_remote_retrieve_body( $response ), true );
    }

    /**
     * Push a refund event to Saudi VAT Pro to create a ZATCA credit note.
     *
     * When $refund_id is provided, the method fetches the WC_Order_Refund object
     * and sends refund-specific line items (svp_refund_line_items) so the server
     * can generate a credit note for only the refunded lines — not the entire order.
     * This is essential for partial refunds where the order stays in "processing".
     *
     * @param WC_Order $order      The parent order.
     * @param int      $refund_id  WC refund ID (0 = unknown / full-order fallback).
     * @return array|WP_Error
     */
    public static function push_refund( $order, $refund_id = 0 ) {
        $payload = self::build_order_payload( $order );

        if ( $refund_id > 0 ) {
            $refund = wc_get_order( $refund_id );
            if ( $refund instanceof WC_Order_Refund ) {
                $refund_line_items = [];
                foreach ( $refund->get_items() as $item ) {
                    /** @var WC_Order_Item_Product $item */
                    $taxes     = $item->get_taxes();
                    $tax_rates = [];
                    foreach ( $taxes['total'] as $rate_id => $total ) {
                        $rate        = WC_Tax::get_rate_percent( $rate_id );
                        $tax_rates[] = [
                            'rate_percent' => floatval( $rate ),
                            'total'        => $total,
                        ];
                    }
                    // WC refund quantities are negative — use absolute values;
                    // the server treats all CN line items as reductions.
                    $quantity   = abs( $item->get_quantity() );
                    $subtotal   = abs( floatval( $item->get_subtotal() ) );
                    $unit_price = $quantity > 0 ? $subtotal / $quantity : 0;

                    $refund_line_items[] = [
                        'id'        => $item->get_id(),
                        'name'      => $item->get_name(),
                        'quantity'  => $quantity,
                        'price'     => round( $unit_price, 4 ),
                        'subtotal'  => strval( $subtotal ),
                        'total'     => strval( abs( floatval( $item->get_total() ) ) ),
                        'total_tax' => strval( abs( floatval( $item->get_total_tax() ) ) ),
                        'taxes'     => $tax_rates,
                    ];
                }
                if ( ! empty( $refund_line_items ) ) {
                    $payload['svp_refund_line_items'] = $refund_line_items;
                }
            }

            // Include refund ID in meta_data so the server keys idempotency per-refund,
            // allowing multiple credit notes for multiple partial refunds on one order.
            $payload['meta_data'][] = [
                'key'   => '_svp_refund_id',
                'value' => strval( $refund_id ),
            ];
        }

        $webhook_url = get_option( 'svp_webhook_url', '' );
        if ( empty( $webhook_url ) ) {
            return new WP_Error( 'svp_not_configured', 'Webhook URL not set.' );
        }

        $secret = get_option( 'svp_webhook_secret', '' );
        $body   = wp_json_encode( $payload );

        $headers = [
            'Content-Type'          => 'application/json',
            // Use order.refunded topic so server routes by topic before checking status —
            // this handles partial refunds where WC order stays "processing".
            'X-WC-Webhook-Topic'    => 'order.refunded',
            'X-WC-Webhook-Source'   => get_site_url(),
            'X-WC-Webhook-Resource' => 'order',
            'X-WC-Webhook-Event'    => 'refunded',
            'X-SVP-Return-Invoice'  => '1',
        ];

        if ( $secret ) {
            $headers['X-WC-Webhook-Signature'] = base64_encode( hash_hmac( 'sha256', $body, $secret, true ) );
        }

        $response = wp_remote_post( $webhook_url, [
            'headers'     => $headers,
            'body'        => $body,
            'timeout'     => 30,
            'data_format' => 'body',
        ] );

        return is_wp_error( $response ) ? $response : json_decode( wp_remote_retrieve_body( $response ), true );
    }

    /**
     * Build the WooCommerce REST-style order payload Saudi VAT Pro expects.
     *
     * @param WC_Order $order
     * @return array
     */
    public static function build_order_payload( $order ) {
        $vat_number = $order->get_meta( '_vat_number', true );

        $meta_data = [];
        if ( $vat_number ) {
            $meta_data[] = [ 'key' => '_vat_number', 'value' => $vat_number ];
        }

        $line_items = [];
        foreach ( $order->get_items() as $item ) {
            /** @var WC_Order_Item_Product $item */
            $taxes     = $item->get_taxes();
            $tax_rates = [];
            foreach ( $taxes['total'] as $rate_id => $total ) {
                $rate        = WC_Tax::get_rate_percent( $rate_id );
                $tax_rates[] = [
                    'rate_percent' => floatval( $rate ),
                    'total'        => $total,
                ];
            }

            $quantity   = $item->get_quantity();
            $subtotal   = floatval( $item->get_subtotal() );
            $unit_price = $quantity > 0 ? $subtotal / $quantity : 0;

            $line_items[] = [
                'id'        => $item->get_id(),
                'name'      => $item->get_name(),
                'quantity'  => $quantity,
                'price'     => round( $unit_price, 4 ),
                'subtotal'  => strval( $subtotal ),
                'total'     => strval( floatval( $item->get_total() ) ),
                'total_tax' => strval( floatval( $item->get_total_tax() ) ),
                'taxes'     => $tax_rates,
            ];
        }

        return [
            'id'       => $order->get_id(),
            'number'   => $order->get_order_number(),
            'status'   => $order->get_status(),
            'currency' => $order->get_currency(),
            'total'    => $order->get_total(),
            'billing'  => [
                'first_name' => $order->get_billing_first_name(),
                'last_name'  => $order->get_billing_last_name(),
                'company'    => $order->get_billing_company(),
                'address_1'  => $order->get_billing_address_1(),
                'city'       => $order->get_billing_city(),
                'postcode'   => $order->get_billing_postcode(),
                'country'    => $order->get_billing_country(),
                'email'      => $order->get_billing_email(),
            ],
            'meta_data'  => $meta_data,
            'line_items' => $line_items,
        ];
    }
}
