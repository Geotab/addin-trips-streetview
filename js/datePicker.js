var tripPlayAddin = tripPlayAddin || {};

tripPlayAddin.datePicker = function() {
    "use strict";

    var container,
        init = function(cont, callback) {
            var options = {
                    datepickerOptions: {
                        numberOfMonths: 1
                    }
                },
                initState = {
                    start: moment(new Date()).startOf("day").toDate(),
                    end: moment(new Date()).endOf("day").toDate()
                };
            container = cont;
            $(cont).daterangepicker(options);
            $(cont).daterangepicker("setRange", initState);
            $(cont).daterangepicker({onChange: function(){
                callback($(cont).daterangepicker("getRange"));
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
            $(container).daterangepicker("setRange", state);
        },
        getState: function(serialized){
            var value = $(container).daterangepicker("getRange"),
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
            $(container).daterangepicker("destroy");
        }
    };
};
