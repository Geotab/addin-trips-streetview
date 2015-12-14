var tripPlayAddin = tripPlayAddin || {};

tripPlayAddin.utils = (function(){
    "use strict";
    return {
        escape: function(e){
            return String(e || "")
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        },
        stripTags: function(e) {
            return e.replace(/(&nbsp;|<([^>]+)>)/ig, "");
        },
        extend: function(array){
            return array.slice(0);
        }
    };
})();
