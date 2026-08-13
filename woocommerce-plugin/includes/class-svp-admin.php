<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class SVP_Admin {

    public static function init() {
        add_filter( 'woocommerce_settings_tabs_array', [ __CLASS__, 'add_settings_tab' ], 50 );
        add_action( 'woocommerce_settings_tabs_saudi_vat_pro', [ __CLASS__, 'render_settings_tab' ] );
        add_action( 'woocommerce_update_options_saudi_vat_pro', [ __CLASS__, 'save_settings' ] );
    }

    public static function add_settings_tab( $tabs ) {
        $tabs['saudi_vat_pro'] = __( 'Saudi VAT Pro', 'saudi-vat-pro' );
        return $tabs;
    }

    public static function render_settings_tab() {
        woocommerce_admin_fields( self::get_settings() );
    }

    public static function save_settings() {
        woocommerce_update_options( self::get_settings() );
    }

    public static function get_settings() {
        return [
            [
                'title' => __( 'Saudi VAT Pro — ZATCA Phase 2 Invoicing', 'saudi-vat-pro' ),
                'type'  => 'title',
                'desc'  => sprintf(
                    /* translators: %s: link to Saudi VAT Pro */
                    __( 'Connect your store to <a href="%s" target="_blank">Saudi VAT Pro</a> to automatically generate ZATCA-compliant invoices for every paid order.', 'saudi-vat-pro' ),
                    'https://saudivat.pro'
                ),
                'id'    => 'svp_section_title',
            ],
            [
                'title'    => __( 'API Key', 'saudi-vat-pro' ),
                'type'     => 'password',
                'desc'     => __( 'Copy your API key from <strong>Saudi VAT Pro → Settings → API Keys</strong>. Used by the plugin to authenticate direct order submissions.', 'saudi-vat-pro' ),
                'id'       => 'svp_api_key',
                'default'  => '',
                'desc_tip' => false,
            ],
            [
                'title'    => __( 'Site URL', 'saudi-vat-pro' ),
                'type'     => 'text',
                'desc'     => __( 'Saudi VAT Pro service URL. Leave as default unless you are using a self-hosted installation.', 'saudi-vat-pro' ),
                'id'       => 'svp_site_url',
                'default'  => 'https://saudivat.pro',
                'css'      => 'width:100%;max-width:400px;',
                'desc_tip' => false,
            ],
            [
                'title'    => __( 'Webhook URL', 'saudi-vat-pro' ),
                'type'     => 'text',
                'desc'     => __( 'Copy this from your Saudi VAT Pro dashboard under <strong>Settings → Integrations → WooCommerce</strong>. This URL already contains your unique auth token — paste it as-is into each WooCommerce webhook you create.', 'saudi-vat-pro' ),
                'id'       => 'svp_webhook_url',
                'default'  => '',
                'css'      => 'width:100%;max-width:600px;',
                'desc_tip' => false,
            ],
            [
                'title'    => __( 'Webhook Secret', 'saudi-vat-pro' ),
                'type'     => 'password',
                'desc'     => __( 'Copy the <strong>Secret Token</strong> from your Saudi VAT Pro dashboard. Paste it here <em>and</em> into the "Secret" field of every WooCommerce webhook you create. This is used to sign payloads so Saudi VAT Pro can verify they are authentic.', 'saudi-vat-pro' ),
                'id'       => 'svp_webhook_secret',
                'default'  => '',
                'desc_tip' => false,
            ],
            [
                'title'    => __( 'Show VAT Number field at checkout', 'saudi-vat-pro' ),
                'type'     => 'checkbox',
                'desc'     => __( 'Adds an optional "VAT Number" field to the billing section. Business buyers fill this in to receive a Standard (B2B) tax invoice instead of a Simplified one.', 'saudi-vat-pro' ),
                'id'       => 'svp_show_vat_field',
                'default'  => 'yes',
            ],
            [
                'type' => 'sectionend',
                'id'   => 'svp_section_end',
            ],
        ];
    }
}
