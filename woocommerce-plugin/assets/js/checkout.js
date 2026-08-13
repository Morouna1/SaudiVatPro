/* Saudi VAT Pro — WooCommerce checkout VAT field toggle & validation */
( function ( $ ) {
    'use strict';

    var VAT_RE = /^[0-9]{15}$/;

    /**
     * Show or hide the entire VAT section based on billing country.
     * The ZATCA VAT number field is only relevant for Saudi Arabia (SA).
     * When the customer switches away from SA the field is cleared so it
     * cannot accidentally influence invoice generation for non-SA buyers.
     */
    function updateVatSectionByCountry() {
        var country  = $( '#billing_country' ).val();
        var $section = $( '#svp-vat-section' );

        if ( country === 'SA' ) {
            $section.show();
        } else {
            $section.hide();
            // Collapse expand panel and clear the value
            $( '#svp-vat-field-wrap' ).hide();
            $( '#svp-vat-link' ).attr( 'aria-expanded', 'false' );
            $( '#_vat_number' ).val( '' ).css( 'border-color', '' );
        }
    }

    function toggleVatField( e ) {
        if ( e ) e.preventDefault();
        var $wrap = $( '#svp-vat-field-wrap' );
        var $link = $( '#svp-vat-link' );
        var open  = $wrap.is( ':visible' );

        if ( open ) {
            $wrap.slideUp( 200 );
            $link.attr( 'aria-expanded', 'false' );
            $link.html( '&#9656; ' + $link.data( 'label-closed' ) );
        } else {
            $wrap.slideDown( 200 );
            $link.attr( 'aria-expanded', 'true' );
            $link.html( '&#9662; ' + $link.data( 'label-open' ) );
            $wrap.find( 'input' ).first().focus();
        }
    }

    $( document ).ready( function () {
        var $link = $( '#svp-vat-link' );

        // Preserve labels for toggle
        var labelClosed = $link.text().replace( /^[▶▷▸] ?/, '' ).trim();
        var labelOpen   = labelClosed;
        $link.data( 'label-closed', labelClosed );
        $link.data( 'label-open', labelOpen );

        $link.on( 'click', toggleVatField );

        // If there is already a value (e.g. page reload with error), keep it open
        var $input = $( '#_vat_number' );
        if ( $input.val() && $input.val().trim() !== '' ) {
            $( '#svp-vat-field-wrap' ).show();
            $link.attr( 'aria-expanded', 'true' );
        }

        // Live format feedback
        $input.on( 'input', function () {
            var val = $( this ).val().replace( /\D/g, '' ).slice( 0, 15 );
            $( this ).val( val );
            var valid = VAT_RE.test( val ) || val === '';
            $( this ).css( 'border-color', valid ? '' : '#cc1818' );
        } );

        // Block form submit if VAT is partially filled but invalid
        $( 'form.woocommerce-checkout' ).on( 'checkout_place_order', function () {
            var val = $input.val();
            if ( val !== '' && ! VAT_RE.test( val ) ) {
                $( '#svp-vat-field-wrap' ).show();
                $link.attr( 'aria-expanded', 'true' );
                $input.focus();
                return false;
            }
            return true;
        } );

        // Initial billing-country-based visibility check
        updateVatSectionByCountry();

        // React to WooCommerce's AJAX-driven country/state update events
        $( document.body ).on( 'country_to_state_changed updated_checkout', updateVatSectionByCountry );

        // Also watch the select directly for immediate feedback
        $( document.body ).on( 'change', '#billing_country', updateVatSectionByCountry );
    } );
} )( jQuery );
