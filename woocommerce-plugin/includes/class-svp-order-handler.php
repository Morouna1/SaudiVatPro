<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class SVP_Order_Handler {

    public static function init() {
        // Fire when payment is completed
        add_action( 'woocommerce_payment_complete', [ __CLASS__, 'handle_payment_complete' ] );
        // Also fire when status changes to processing or completed (covers manual orders)
        add_action( 'woocommerce_order_status_processing', [ __CLASS__, 'handle_order_status_change' ] );
        add_action( 'woocommerce_order_status_completed', [ __CLASS__, 'handle_order_status_change' ] );
        // woocommerce_order_refunded fires for EVERY refund (partial or full) with both
        // order_id and refund_id. Using only this hook avoids double-submitting credit
        // notes that would happen if we also hooked woocommerce_order_fully_refunded /
        // woocommerce_order_status_refunded (which fire after, for the same full-refund event).
        add_action( 'woocommerce_order_refunded', [ __CLASS__, 'handle_partial_refund' ], 10, 2 );
        // Show invoice download in My Account
        add_action( 'woocommerce_order_details_after_order_table', [ __CLASS__, 'show_invoice_link' ] );
        // Include invoice link in order emails
        add_action( 'woocommerce_email_after_order_table', [ __CLASS__, 'add_invoice_link_to_email' ], 10, 4 );
        // Admin retry action
        add_action( 'woocommerce_order_action_svp_retry', [ __CLASS__, 'admin_retry_action' ] );
        add_filter( 'woocommerce_order_actions', [ __CLASS__, 'add_admin_retry_action' ] );
    }

    /**
     * Called when woocommerce_payment_complete fires.
     */
    public static function handle_payment_complete( $order_id ) {
        self::push_order_to_svp( $order_id, 'payment_complete' );
    }

    /**
     * Called when order status changes to processing or completed.
     */
    public static function handle_order_status_change( $order_id ) {
        // Avoid duplicate: if we already have an invoice ID, skip
        $existing = get_post_meta( $order_id, '_svp_invoice_id', true );
        if ( $existing ) {
            return;
        }
        self::push_order_to_svp( $order_id, 'status_change' );
    }

    /**
     * Push a paid order to Saudi VAT Pro.
     */
    private static function push_order_to_svp( $order_id, $trigger = 'unknown' ) {
        $order = wc_get_order( $order_id );
        if ( ! $order ) return;

        $logger = wc_get_logger();
        $ctx    = [ 'source' => 'saudi-vat-pro' ];

        $logger->info( "SVP: Pushing order #{$order_id} to Saudi VAT Pro (trigger: {$trigger})", $ctx );

        $result = SVP_API_Client::push_order( $order );

        if ( is_wp_error( $result ) ) {
            $msg = $result->get_error_message();
            $logger->error( "SVP: Failed to push order #{$order_id}: {$msg}", $ctx );
            update_post_meta( $order_id, '_svp_error', $msg );
            return;
        }

        if ( isset( $result['invoiceId'] ) ) {
            update_post_meta( $order_id, '_svp_invoice_id', sanitize_text_field( $result['invoiceId'] ) );
        }
        if ( isset( $result['pdfUrl'] ) ) {
            update_post_meta( $order_id, '_svp_invoice_url', esc_url_raw( $result['pdfUrl'] ) );
        }
        delete_post_meta( $order_id, '_svp_error' );

        $logger->info( "SVP: Order #{$order_id} pushed successfully", $ctx );
    }

    /**
     * Handle every refund (partial or full) via the woocommerce_order_refunded hook.
     * Passes the specific WC refund ID so the server can create one credit note per
     * refund event and use the exact refunded line items (not the full order).
     *
     * @param int $order_id  The parent order ID.
     * @param int $refund_id The WooCommerce WC_Order_Refund ID.
     */
    public static function handle_partial_refund( $order_id, $refund_id ) {
        $order = wc_get_order( $order_id );
        if ( ! $order ) return;

        $logger = wc_get_logger();
        $ctx    = [ 'source' => 'saudi-vat-pro' ];

        $invoice_id = get_post_meta( $order_id, '_svp_invoice_id', true );
        if ( ! $invoice_id ) {
            $logger->info( "SVP: No invoice for order #{$order_id} (refund #{$refund_id}) — skipping credit note", $ctx );
            return;
        }

        $logger->info( "SVP: Refund #{$refund_id} on order #{$order_id} — submitting credit note", $ctx );

        $result = SVP_API_Client::push_refund( $order, intval( $refund_id ) );

        if ( is_wp_error( $result ) ) {
            $logger->error( "SVP: Credit note push failed for order #{$order_id} refund #{$refund_id}: " . $result->get_error_message(), $ctx );
        } else {
            $logger->info( "SVP: Credit note submitted for order #{$order_id} refund #{$refund_id}", $ctx );
        }
    }

    /**
     * Handle refund: push full order (status=refunded) to trigger credit note.
     */
    public static function handle_refund( $order_id ) {
        $order = wc_get_order( $order_id );
        if ( ! $order ) return;

        $logger = wc_get_logger();
        $ctx    = [ 'source' => 'saudi-vat-pro' ];

        // Check for existing invoice to credit against
        $invoice_id = get_post_meta( $order_id, '_svp_invoice_id', true );
        if ( ! $invoice_id ) {
            $logger->info( "SVP: No invoice found for order #{$order_id}, skipping credit note", $ctx );
            return;
        }

        $logger->info( "SVP: Pushing refund for order #{$order_id}", $ctx );

        $result = SVP_API_Client::push_refund( $order );

        if ( is_wp_error( $result ) ) {
            $logger->error( "SVP: Refund push failed for order #{$order_id}: " . $result->get_error_message(), $ctx );
        } else {
            $logger->info( "SVP: Refund credit note created for order #{$order_id}", $ctx );
        }
    }

    /**
     * Show "Download Tax Invoice" button on My Account → Order details.
     */
    public static function show_invoice_link( $order ) {
        $url = $order->get_meta( '_svp_invoice_url', true );
        if ( ! $url ) return;

        echo '<section class="woocommerce-order-svp-invoice" style="margin-top:20px;">';
        echo '<h2 class="woocommerce-order-details__title">' . esc_html__( 'Tax Invoice', 'saudi-vat-pro' ) . '</h2>';
        echo '<p>' . esc_html__( 'Your ZATCA-compliant tax invoice is ready.', 'saudi-vat-pro' ) . '</p>';
        echo '<a href="' . esc_url( $url ) . '" class="button" download>';
        echo esc_html__( 'Download Tax Invoice (PDF)', 'saudi-vat-pro' );
        echo '</a>';
        echo '</section>';
    }

    /**
     * Add invoice link to order confirmation email.
     */
    public static function add_invoice_link_to_email( $order, $sent_to_admin, $plain_text, $email ) {
        $url = $order->get_meta( '_svp_invoice_url', true );
        if ( ! $url ) return;

        if ( $plain_text ) {
            echo "\n" . __( 'Tax Invoice (ZATCA):', 'saudi-vat-pro' ) . ' ' . esc_url( $url ) . "\n";
        } else {
            echo '<p style="margin:20px 0 0;">';
            echo '<strong>' . esc_html__( 'Your ZATCA Tax Invoice:', 'saudi-vat-pro' ) . '</strong> ';
            echo '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Download PDF', 'saudi-vat-pro' ) . '</a>';
            echo '</p>';
        }
    }

    /**
     * Register a "Retry Saudi VAT Pro" action in WooCommerce order admin.
     */
    public static function add_admin_retry_action( $actions ) {
        $actions['svp_retry'] = __( 'Retry Saudi VAT Pro submission', 'saudi-vat-pro' );
        return $actions;
    }

    /**
     * Handle the admin retry.
     */
    public static function admin_retry_action( $order ) {
        delete_post_meta( $order->get_id(), '_svp_invoice_id' );
        delete_post_meta( $order->get_id(), '_svp_invoice_url' );
        self::push_order_to_svp( $order->get_id(), 'admin_retry' );
    }
}
