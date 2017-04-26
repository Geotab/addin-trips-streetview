var tripPlayAddin = tripPlayAddin || {};

tripPlayAddin.datePicker = function() {
    "use strict";

    var container,
        init = function(cont, callback) {
            var options = {
                    ranges: {
                        "Today": [moment().startOf("day"), moment().endOf("day")],
                        "Yesterday": [moment().subtract('days', 1).startOf("day"), moment().subtract('days', 1).endOf("day")],
                        "Last 7 Days": [moment().subtract('days', 6).startOf("day"), moment().endOf("day")],
                        "Last Week (Mo-Su)": [moment().subtract('days', 7).isoWeekday(1).startOf("day"), moment().subtract('days', 7).isoWeekday(7).endOf("day")],
                        "Current Month": [moment().startOf('month').startOf("day"), moment().endOf("day")],
                        "Previous Month": [moment().subtract('month', 1).startOf('month').startOf("day"), moment().subtract('month', 1).endOf('month').endOf("day")],
                    },
                    timePicker: true,
                    showCustomRangeLabel: true,
                    alwaysShowCalendars: true,
                    autoApply: false,
                    buttonClasses: "geotabButton",
                    applyClass: "positiveButton"
                },
                initState = {
                    start: moment(new Date()).startOf("day").toDate(),
                    end: moment(new Date()).endOf("day").toDate()
                };
            container = cont;
            jQuery(cont).daterangepicker(options);
            jQuery(cont).data("daterangepicker").setStartDate(initState.start);
            jQuery(cont).data("daterangepicker").setEndDate(initState.end);
            jQuery(cont).on("apply.daterangepicker", function(ev, picker) {
                callback({
                    start: picker.startDate,
                    end: picker.endDate
                });
            });
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
            jQuery(container).data("daterangepicker").setStartDate(state.start);
            jQuery(container).data("daterangepicker").setEndDate(state.end);
        },
        getState: function(serialized){
            var value = jQuery(container).data("daterangepicker"),
                res = {
                    start: moment(value.startDate).toDate(),
                    end: moment(value.endDate).toDate()
                };
            return {
                start: (serialized) ? res.start.toISOString() : res.start,
                end: (serialized) ? res.end.toISOString() : res.end
            };
        },
        unload: function(){
            //jQuery(container).daterangepicker("destroy");
        }
    };
};
