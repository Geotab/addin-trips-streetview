var tripPlayAddin = tripPlayAddin || {};

tripPlayAddin.optionsToolbar = (function() {
    "use strict";

    var devicesSelect,
        datePicker,
        tripsSelect,
        currentData = {},// current data
        applyCallback,
        utils = tripPlayAddin.utils,
        initDevicesSelect = function() {
            var container = document.querySelector(".tripPlay_devices-select");
            return ExtSelect(container, {
                width: 250,
                selectAll: false,
                popupHeight: 400,
                onClose: function(isClickedOutside){
                    if(!currentData.devices.length && devicesSelect.getOptionsCount() > 0) {
                        tripsSelect.setSelected([]);
                        if(isClickedOutside) {
                            devicesSelect.open();
                        }
                    }
                    devicesSelect.setFilter("");
                    currentData.devicesFilter = null;
                },
                onClick: function(value, state){
                    var position;
                    if(state) {
                        currentData.devices.push(value);
                    } else {
                        position = currentData.devices.indexOf(value);
                        if(position > -1) {
                            currentData.devices.splice(position, 1);
                        }
                    }
                    applyOptions(true);
                },
                onBeforeFilter: function(value){
                    currentData.devicesFilter = value;
                    applyOptions();
                    currentData.devicesFilter = null;
                    return false;
                }
            });
        },
        initDatePicker = function(cont) {
            var datePicker = tripPlayAddin.datePicker();
            datePicker.init(cont, function(){
                currentData.datePicker = datePicker.getState(true);
                if(devicesSelect.getOptionsCount()) {
                    if(!devicesSelect.getSelected()) {
                        devicesSelect.open();
                    }
                    applyOptions(true);
                }
            });
            return datePicker;
        },
        initTripsSelect = function() {
            var container = document.querySelector(".tripPlay_trip-select");
            return ExtSelect(container, {
                width: 350,
                multiple: false,
                popupHeight: 400,
                itemsLimit: 300,
                onOpen: function(){
                    currentData.trips = getOptions().trips;
                },
                onClick: function(){
                    var selected = tripsSelect.getSelected();
                    if(!currentData.trips.equals(selected)) {
                        currentData.trips = selected;
                        applyOptions();
                    }
                },
                onBeforeClose: function(isClickedOutside){
                    return (!isClickedOutside || currentData.trips.length || tripsSelect.isDisabled());
                },
                onClose: function(){
                    tripsSelect.setFilter("");
                    currentData.tripsFilter = null;
                    tripsSelect.setSelected(currentData.trips);
                },
                onFilter: function(){
                    currentData.trips = getOptions().trips;
                    tripsSelect.setSelected(currentData.trips);
                    applyOptions();
                }
            });
        },
        setDevices = function(options) {
            var optionsArray = [];

            Object.keys(options).forEach(function(deviceName){
                var deviceId = options[deviceName];
                optionsArray.push({
                    value: deviceId,
                    label: utils.escape(deviceName),
                    selected: checkDeviceSelected(deviceId)
                });
            });
            devicesSelect.setItems(optionsArray);
            if(currentData.devices && !currentData.devices.length) {
                devicesSelect.open();
                tripsSelect.setSelected([]);
                tripsSelect.setItems([]);
                applyOptions(true);
            }
        },
        checkDeviceSelected = function(deviceId) {
            return (currentData.devices && currentData.devices.indexOf(deviceId) > -1);
        },
        getTripName = function(tripData) {
            return "<span class='address'>" + tripData.stopPoint.address + "</span>" +
                "<span class='time'>" +
                moment(tripData.start).format("lll") + " - " +
                moment(tripData.stop).format("lll") + "</span>";
        },
        setTrips = function(options) {
            var optionsArray = [];
            //tripsSelect[Object.keys(options).length ? "enable" : "disable"]();
            if(!Object.keys(options).length) {
                tripsSelect.setSelected([]);
                tripsSelect.disable();
            } else {
                tripsSelect.enable();
            }
            Object.keys(options).forEach(function(tripId){
                var tripData = options[tripId],
                    tripName = getTripName(tripData);
                optionsArray.push({
                    value: tripId,
                    label: tripName,
                    selected: checkTripSelected(tripId)
                });
            });
            tripsSelect.setItems(optionsArray);
            currentData.trips = tripsSelect.getSelected();

            if(currentData.trips && !currentData.trips.length) {
                tripsSelect.open();
            }
        },
        checkTripSelected = function(tripId) {
            return (currentData.trips && currentData.trips.indexOf(tripId) > -1);
        },
        applyOptions = function(needTrips) {
            applyCallback(currentData, needTrips);
        },
        getOptions = function() {
            return currentData;
        },
        getSelected = function(serialized) {
             var options = {
                 datePicker: datePicker.getState(serialized),
                 devices: devicesSelect.getSelected() || [],
                 trips: tripsSelect.getSelected() || [],
                 devicesFilter: devicesSelect.getFilter(),
                 tripsFilter: tripsSelect.getFilter()
             };
             return Object.keys(options).reduce(function(res, name) {
                 if(options[name] !== "undefined") {
                    res[name] = options[name];
                 }
                 return res;
             }, {});
        },
        setSelected = function(options) {
            currentData = {
                datePicker: options.datePicker || datePicker.getState(true),
                devices: options.devices || devicesSelect.getSelected(),
                trips: options.trips || tripsSelect.getSelected()
            };
            devicesSelect.setSelected(currentData.devices);
            tripsSelect.setSelected(currentData.trips);

            if(!currentData.devices.length) {
                devicesSelect.open();
            }
            if(!currentData.trips.length) {
                tripsSelect.open();
            }
        },
        setOptions = function(options) {
            currentData = {
                datePicker: options.datePicker || datePicker.getState(true),
                devices: options.devices || devicesSelect.getSelected(),
                trips: options.trips || tripsSelect.getSelected()
            };

            datePicker.setState(options.datePicker, true);
            devicesSelect.setSelected(options.devices || []);
            tripsSelect.setSelected(options.trips || []);
            devicesSelect.setFilter(options.devicesFilter || null);
            tripsSelect.setFilter(options.tripsFilter || null);
        },
        setDefaultData = function(data) {
            var devices = {},
                trips = {};
            if(data.devices ) {
                devices = data.devices.reduce(function(devices, device){
                    var deviceData = device[0] || device;
                    if(deviceData) {
                        devices[deviceData.id] = deviceData.name;
                    }
                    return devices;
                }, {});
                devicesSelect.setInitSelectedData(devices);
            }

            if(data.trips ) {
                trips = data.trips.reduce(function(trips, trip){
                    var tripData = trip[0] || trip;
                    if(tripData) {
                        trips[tripData.id] = tripData.name;
                    }
                    return trips;
                }, {});
                tripsSelect.setInitSelectedData(trips);
            }
        },
        ExtSelect = window.ExtSelect;
    delete window.ExtSelect;

    Array.prototype.equals = function (array, strict) {
        if (!array || this.length !== array.length) {
            return false;
        }
        if (arguments.length === 1) {
            strict = true;
        }

        for (var i = 0; i < this.length; i++) {
            if (this[i] instanceof Array && array[i] instanceof Array) {
                if (!this[i].equals(array[i], strict)) {
                    return false;
                }
            } else if (strict && this[i] !== array[i]) {
                return false;
            } else if (!strict) {
                return this.sort().equals(array.sort(), true);
            }
        }
        return true;
    };

    return {
        init: function(callback) {
            devicesSelect = initDevicesSelect();
            tripsSelect = initTripsSelect();
            datePicker = initDatePicker(document.querySelector("#tripPlay_datePicker"));
            applyCallback = callback;
        },
        getOptions: getOptions,
        getSelected: getSelected,
        setSelected: setSelected,
        setOptions: setOptions,
        setDevices: setDevices,
        setTrips: setTrips,
        setDefaultData: setDefaultData,
        unload: function(){
            devicesSelect.setItems([]);
            devicesSelect.setSelected([]);
            devicesSelect.close();
            tripsSelect.setItems([]);
            tripsSelect.setSelected([]);
            tripsSelect.disable();
            tripsSelect.close();
            currentData = {};
        }
    };
})();