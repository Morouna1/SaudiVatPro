<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class SVP_Checkout {

    public static function init() {
        if ( get_option( 'svp_show_vat_field', 'yes' ) !== 'yes' ) {
            return;
        }

        // Always register the field hooks; the JS in checkout.js hides the VAT
        // section until the customer selects Saudi Arabia as their billing country.
        add_action( 'woocommerce_after_billing_form', [ __CLASS__, 'render_vat_field' ] );
        add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue_scripts' ] );
        add_action( 'woocommerce_checkout_process', [ __CLASS__, 'validate_vat_field' ] );
        add_action( 'woocommerce_checkout_update_order_meta', [ __CLASS__, 'save_vat_field' ] );
        add_action( 'woocommerce_admin_order_data_after_billing_address', [ __CLASS__, 'display_vat_in_admin' ] );
        add_filter( 'woocommerce_email_order_meta_fields', [ __CLASS__, 'add_vat_to_emails' ], 10, 3 );
    }

    /**
     * Inject the optional VAT number field after the billing form.
     */
    public static function render_vat_field( $checkout ) {
        echo '<div id="svp-vat-section">';
        echo '<div id="svp-vat-toggle" style="margin-top:16px;margin-bottom:8px;">';
        echo '<a href="#" id="svp-vat-link" style="font-size:13px;color:#666;text-decoration:none;" aria-expanded="false">';
        echo '&#9656; ' . esc_html__( 'Buying for your company? Add your VAT number to receive a tax invoice', 'saudi-vat-pro' );
        echo '</a>';
        echo '</div>';

        echo '<div id="svp-vat-field-wrap" style="display:none;">';
        woocommerce_form_field( '_vat_number', [
            'type'        => 'text',
            'label'       => __( 'Company VAT Number', 'saudi-vat-pro' ),
            'placeholder' => __( '15-digit Saudi VAT number', 'saudi-vat-pro' ),
            'required'    => false,
            'class'       => [ 'form-row-wide' ],
            'custom_attributes' => [
                'maxlength'   => '15',
                'pattern'     => '[0-9]{15}',
                'inputmode'   => 'numeric',
                'autocomplete' => 'off',
            ],
        ], $checkout->get_value( '_vat_number' ) );
        echo '<p style="font-size:12px;color:#888;margin-top:-8px;">' . esc_html__( 'Optional. Leave blank for a standard simplified invoice.', 'saudi-vat-pro' ) . '</p>';
        echo '</div>';
        echo '</div>';
    }

    /**
     * Enqueue the JS that toggles the VAT field and validates on submit.
     */
    public static function enqueue_scripts() {
        if ( ! is_checkout() ) return;

        wp_enqueue_script(
            'svp-checkout',
            SVP_WC_PLUGIN_URL . 'assets/js/checkout.js',
            [ 'jquery' ],
            SVP_WC_VERSION,
            true
        );
    }

    /**
     * Server-side validate: if filled in, must be exactly 15 digits.
     */
    public static function validate_vat_field() {
        $vat = isset( $_POST['_vat_number'] ) ? sanitize_text_field( wp_unslash( $_POST['_vat_number'] ) ) : '';
        if ( $vat !== '' && ! preg_match( '/^[0-9]{15}$/', $vat ) ) {
            wc_add_notice(
                __( 'VAT Number must be exactly 15 digits.', 'saudi-vat-pro' ),
                'error'
            );
        }
    }

    /**
     * Save the VAT number to order meta.
     */
    public static function save_vat_field( $order_id ) {
        if ( isset( $_POST['_vat_number'] ) ) {
            $vat = sanitize_text_field( wp_unslash( $_POST['_vat_number'] ) );
            if ( $vat !== '' ) {
                update_post_meta( $order_id, '_vat_number', $vat );
            }
        }
    }

    /**
     * Show the VAT number on the WooCommerce order admin page.
     */
    public static function display_vat_in_admin( $order ) {
        $vat = $order->get_meta( '_vat_number', true );
        if ( $vat ) {
            echo '<p><strong>' . esc_html__( 'VAT Number', 'saudi-vat-pro' ) . ':</strong> ' . esc_html( $vat ) . '</p>';
        }
    }

    /**
     * Include VAT number in WooCommerce order emails.
     */
    public static function add_vat_to_emails( $fields, $sent_to_admin, $order ) {
        $vat = $order->get_meta( '_vat_number', true );
        if ( $vat ) {
            $fields['vat_number'] = [
                'label' => __( 'VAT Number', 'saudi-vat-pro' ),
                'value' => $vat,
            ];
        }
        return $fields;
    }
}
