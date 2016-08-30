/*!
 * Confirm dialog plugin
 * 
 * @version 1.0
 * @author Mikko Tikkanen <mikko.tikkanen@gmail.com>
 */
/* jshint devel:true, browser: true */
/* global jQuery */
;(function(window, document, $, undefined) {
	var methods = {},	// Methods namespace
		O = {};			// Options
	
	
		
	/* Confirm modal method
	 *
	 * Shows the actual confirm dialog + background
	 * ----------------------------------------------------------------------------------------- */
	methods.confirm = function(message, callback, e) {
        if(typeof message == 'function') { callback = message; message = null; }
        callback = callback || function() {};
		message = message || 'Are you sure?';
        
        // Create confirm background & do the confirm dance
        var el = $('<div />');
        el.css({
            position: 'fixed',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            background: '#000',
            opacity: 0.5,
            zIndex: 9999
        });
        $('body').prepend(el);
		var result = confirm(message);
		el.remove();
		
		// Declined
		if(result !== true) { e.preventDefault(); return; }
		
        // Accepted - Run callback and trigger confirm event when called to element
        callback();
        if(typeof this == 'object') {
            $(this).trigger('confirm');
        }
	};
	
	
	/* Set option method
	 * ------------------------------------------------------------------------------------------ */
	methods.set = function(key, value) {
		O[key] = value;
	};
	
	
	/* Plugin base logic
	 * ------------------------------------------------------------------------------------------ */
	$.confirm = function(method) {
		if(methods[method]) {
			return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
		} else {
			return methods.confirm.apply(this, arguments);
		}
	};
	
    
    
	// JQuery confirm shorthand
	$.fn.confirm = function(fnc) {
		this.click(function(e) {
            e.preventDefault();
            $.confirm.call(this, $(this).data('confirm'), fnc, e);
        });
	};
    
    // Hook to $.fn.on, to handle 'confirm' bindings
    var originalOn = $.fn.on;
    $.fn.on = function(type) {
        // When confirm event is bound, also bind click event to fire the confirm dialog
        if(type == 'confirm') {
            var args = [].slice.call(arguments, 0);
            args[0] = 'click';
            args[args.length-1] = function(e) {
                e.preventDefault();
                $.confirm.call(this, ($(e.target).closest('[data-confirm]').data('confirm') || ''));
            };
            originalOn.apply(this, args);
        }
        return originalOn.apply(this, arguments);
    };
	
	
	// Add automatic confirm handlers
	$(document).ready(function() {
 		$('[data-confirm]').click(function(e) { $.confirm.call(this, $(this).data('confirm'), null, e); });
 	});

})(window, document, jQuery);
