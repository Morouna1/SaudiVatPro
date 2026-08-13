<?php
/**
 * Plugin Name:       Saudi VAT Pro — WooCommerce
 * Plugin URI:        https://saudivat.pro
 * Description:       Automatic ZATCA Phase 2 e-invoicing for WooCommerce. Every paid order generates a ZATCA-compliant invoice, B2B buyers enter their VAT number at checkout, and refunds create credit notes — all without lifting a finger.
 * Version:           1.0.0
 * Author:            Saudi VAT Pro
 * Author URI:        https://saudivat.pro
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       saudi-vat-pro
 * Domain Path:       /languages
 * Requires at least: 6.0
 * Requires PHP:      8.0
 * WC requires at least: 7.0
 * WC tested up to:   9.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'SVP_WC_VERSION', '1.0.0' );
define( 'SVP_WC_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'SVP_WC_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

/**
 * Declare HPOS compatibility.
 */
add_action( 'before_woocommerce_init', function () {
    if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
    }
} );

/**
 * Bootstrap — load after WooCommerce.
 */
add_action( 'plugins_loaded', function () {
    if ( ! class_exists( 'WooCommerce' ) ) {
        add_action( 'admin_notices', function () {
            echo '<div class="error"><p><strong>Saudi VAT Pro</strong> requires WooCommerce to be installed and active.</p></div>';
        } );
        return;
    }

    require_once SVP_WC_PLUGIN_DIR . 'includes/class-svp-admin.php';
    require_once SVP_WC_PLUGIN_DIR . 'includes/class-svp-api-client.php';
    require_once SVP_WC_PLUGIN_DIR . 'includes/class-svp-checkout.php';
    require_once SVP_WC_PLUGIN_DIR . 'includes/class-svp-order-handler.php';

    SVP_Admin::init();
    SVP_Checkout::init();
    SVP_Order_Handler::init();
} );

register_activation_hook( __FILE__, 'svp_wc_activate' );
function svp_wc_activate() {
    add_option( 'svp_api_key', '' );
    add_option( 'svp_webhook_url', '' );
    add_option( 'svp_show_vat_field', 'yes' );
}
