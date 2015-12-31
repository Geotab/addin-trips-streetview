var tripPlayAddin = tripPlayAddin || {};

tripPlayAddin.datePicker = function() {
    "use strict";

    var container,
        init = function(cont, callback) {
            var options = {
                    presetRanges: [
                        {text: 'Today', dateStart: function() { return moment(); }, dateEnd: function() { return moment(); } },
                        {text: 'Yesterday', dateStart: function() { return moment().subtract('days', 1); }, dateEnd: function() { return moment().subtract('days', 1); } },
                        {text: 'Last 7 Days', dateStart: function() { return moment().subtract('days', 6); }, dateEnd: function() { return moment(); } },
                        {text: 'Last Week (Mo-Su)', dateStart: function() { return moment().subtract('days', 7).isoWeekday(1); }, dateEnd: function() { return moment().subtract('days', 7).isoWeekday(7); } },
                        {text: 'Month to Date', dateStart: function() { return moment().startOf('month'); }, dateEnd: function() { return moment(); } },
                        {text: 'Previous Month', dateStart: function() { return moment().subtract('month', 1).startOf('month'); }, dateEnd: function() { return moment().subtract('month', 1).endOf('month'); } }
                    ],
                    datepickerOptions: {
                        numberOfMonths: 1
                    }
                },
                initState = {
                    start: moment(new Date()).startOf("day").toDate(),
                    end: moment(new Date()).endOf("day").toDate()
                };
            container = cont;
            jQuery(cont).daterangepicker(options);
            jQuery(cont).daterangepicker("setRange", initState);
            jQuery(cont).daterangepicker({onChange: function(){
                callback(jQuery(cont).daterangepicker("getRange"));
            }});
        };
    return {
        init: init,
        setState: function(state, serialized){
            if(!state) {
                return false;
            }
            if(serialized) {
                state = {
                    start: (state.start) ? new Date(state.start) : new Date(),
                    end: (state.end) ? new Date(state.end) : new Date()
                };
            }
            jQuery(container).daterangepicker("setRange", state);
        },
        getState: function(serialized){
            var value = jQuery(container).daterangepicker("getRange"),
                res = {
                    start: moment(value.start).startOf("day").toDate(),
                    end: moment(value.end).endOf("day").toDate()
                };
            return {
                start: (serialized) ? res.start.toISOString() : res.start,
                end: (serialized) ? res.end.toISOString() : res.end
            };
        },
        unload: function(){
            jQuery(container).daterangepicker("destroy");
        }
    };
};
