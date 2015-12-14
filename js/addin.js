var tripPlayAddin = tripPlayAddin || {};

geotab.addin.tripPlay = function(api, state) {
    "use strict";

    var optionsToolbar = tripPlayAddin.optionsToolbar,
        player = tripPlayAddin.player,
        utils = tripPlayAddin.utils,
        tripsSearchParams = {
            fromDate: new Date(),
            toDate: new Date(),
            devices: []
        },
        defaultDevicesList = {},
        config = {
            devicesLimit: 100
        },
        currTrip,
        tripsList = {},
        initialize = function() {
            optionsToolbar.init(applyOptions);
        },
        loadDevicesContent = function(filter) {
            var waiting = tripPlayAddin.waiting(),
                hasFilter = typeof filter === "string";

            if(!hasFilter && Object.keys(defaultDevicesList).length) {
                optionsToolbar.setDevices(defaultDevicesList);
                applyOptions(optionsToolbar.getOptions(), true);
                return false;
            }
            waiting.start(document.querySelector(".tripPlay_trip-select .es-popup"));
            getDevices(filter).then(function(devices){
                var devicesList = {};
                if (devices) {
                    if (devices.length) {
                        devices.forEach(function (device) {
                            devicesList[device.name] = device.id;
                        });
                    }
                    if(!hasFilter) {
                        defaultDevicesList = devicesList;
                    }
                    optionsToolbar.setDevices(devicesList);
                    if(!hasFilter) {
                        applyOptions(optionsToolbar.getOptions(), true);
                    }
                }
            }).finally(waiting.stop);
        },
        getSelectedDevices = function(devices) {
            var waiting = tripPlayAddin.waiting();
            waiting.start(document.querySelector("#checkmateContent"));
            getDevicesByIds(devices).then(function(data){
                optionsToolbar.setDefaultData({
                    devices: data
                });
            }).finally(waiting.stop);
        },
        getSelectedTrip = function(trip) {
            var waiting = tripPlayAddin.waiting();
            waiting.start(document.querySelector("#checkmateContent"));
            getTripById(trip[0]).then(function(data){
                var tripData = data[0] || data;
                if(!Object.keys(tripData).length) {
                    throw new Error("There is no trip with ID provided");
                }
                return getAddresses(getZonesPoints([tripData]));
            }).then(function(addresses){
                var tripData = {id: trip[0], name: addresses[0].formattedAddress};
                optionsToolbar.setDefaultData({
                    trips: [tripData]
                });
            }).catch(showError).finally(waiting.stop);
        },
        loadTripsContent = function(devices, fromDate, toDate) {
            var task,
                availTrips = [],
                waiting = tripPlayAddin.waiting(),
                changedTrips,
                setTripData = function(trips){
                    var prevTripNotExisted = true;
                    Object.keys(trips).forEach(function(tripId){
                        if(tripId === currTrip) {
                            prevTripNotExisted = false;
                        }
                    });
                    optionsToolbar.setTrips(trips);
                    if(prevTripNotExisted) {
                        var options = optionsToolbar.getOptions();
                        options.trips = [];
                        applyOptions(options, false);
                    }
                };
            //if we trying to get history trips then check them
            changedTrips = getChangedTrips(devices, fromDate, toDate, tripsList, tripsSearchParams);

            tripsSearchParams = {
                fromDate: fromDate,
                toDate: toDate,
                devices: utils.extend(devices)
            };
            tripsList = changedTrips.available;

            // If no devices added then load previous trips
            if(!changedTrips.addDevices.length) {
                setTripData(tripsList);
                return false;
            }

            waiting.start(document.querySelector(".tripPlay_trip-select .es-popup"));
            task = getTrips(fromDate, toDate, changedTrips.addDevices).then(function(trips){
                if(trips && !trips.length && task) {
                    task.cancel();
                }
                availTrips = trips.reduce(function(availTrips, trip) {
                    if(devices.indexOf(trip.device.id) > -1) {
                        availTrips.push(trip);
                    }
                    return availTrips;
                }, []);
                if(availTrips && !availTrips.length && task) {
                    task.cancel();
                }
                return getAddresses(getZonesPoints(availTrips));
            }).then(function(addresses) {
                availTrips.forEach(function(trip, index){
                    var tripData = trip;
                    tripData.stopPoint.address = addresses[index].formattedAddress;
                    tripsList[tripData.id] = tripData;
                });
                setTripData(tripsList);
            }).finally(waiting.stop);
        },
        getChangedTrips = function(devices, fromDate, toDate, prevTrips, prevSearchParams) {
            var res = {
                addDevices: [],
                available: {}
            };

            if(toDate > new Date().toISOString() ||
                fromDate !== prevSearchParams.fromDate ||
                toDate !== prevSearchParams.toDate) {
                return {
                    addDevices: devices,
                    available: {}
                };
            }

            devices.forEach(function(device){
                if(prevSearchParams.devices.indexOf(device) === -1){
                    res.addDevices.push(device);
                }
            });

            Object.keys(prevTrips).forEach(function(tripId){
                var tripData = prevTrips[tripId];
                if(tripData.start <= prevSearchParams.toDate &&
                    tripData.stop >= prevSearchParams.fromDate &&
                    devices.indexOf(tripData.device.id) > -1 ) {
                    res.available[tripId] = tripData;
                }
            });

            return res;
        },
        getZonesPoints = function(trips) {
            return trips.map(function(trip) {
                return trip.stopPoint;
            });
        },
        getDevices = function(filter) {
            var request = {
                typeName: "Device",
                search: {
                    groups: state.getGroupFilter()
                },
                resultsLimit: config.devicesLimit
            };
            if(filter) {
                request.search.name = "%" + filter.toLowerCase() + "%";
            }
            return new Promise(function(resolve, reject){
                api.call("Get", request, resolve, reject
                );
            });
        },
        getDevicesByIds = function(devicesIds) {
            var task = devicesIds.map(function(id) {
                    return ["Get", {
                        typeName: "Device",
                        resultsLimit: config.devicesLimit,
                        search: {
                            id: id
                        }
                    }];
                });
            return new Promise(function(resolve, reject){
                api.multiCall(task, resolve, reject
                );
            });
        },
        getTrips = function(fromDate, toDate, devices) {
            var request = {
                typeName: "Trip",
                search: {
                    fromDate: fromDate,
                    toDate: toDate
                }
            };
            if(devices && devices.length === 1) {
                request.search.deviceSearch = {
                    id: devices[0]
                };
            }
            return new Promise(function(resolve, reject){
                api.call("Get", request, resolve, reject);
            });
        },
        getTripById = function(id) {
            return new Promise(function(resolve, reject){
                if(tripsList[id]) {
                    resolve(tripsList[id]);
                } else {
                    api.call("Get", {
                            typeName: "Trip",
                            search: {
                                id: id
                            }
                        }, resolve, reject
                    );
                }
            });
        },
        getAddresses = function(points) {
            return new Promise(function(resolve, reject){
                api.call("GetAddresses", {
                        coordinates: points
                    }, resolve, reject
                );
            });
        },
        getLogs = function(trip) {
            return new Promise(function(resolve, reject){
                api.call("Get", {
                        typeName: "LogRecord",
                        search: {
                            deviceSearch: {
                                id: trip.device.id
                            },
                            fromDate: trip.start,
                            toDate: trip.stop
                        }
                    }, resolve, reject
                );
            });
        },
        getValidPositions = function(trip) {
            return new Promise(function(resolve, reject){
                api.call("Get", {
                        typeName: "StatusData",
                        search: {
                            deviceSearch: {
                                id: trip.device.id
                            },
                            diagnosticSearch: {
                                id: "DiagnosticPositionValidId"
                            },
                            fromDate: trip.start,
                            toDate: trip.stop
                        }
                    }, resolve, reject
                );
            });
        },
        loadTripPoints = function(tripId) {
            var tripData = {},
                tripLogs = [],
                waiting = tripPlayAddin.waiting();
            waiting.start();
            getTripById(tripId)
                .then(function(trip) {
                    tripData = trip[0] || trip;
                    if(!Object.keys(tripData).length) {
                        throw new Error("There is no trip with ID provided");
                    }
                    return getLogs(tripData);
                })
                .then(function(logs) {
                    tripLogs = logs;
                    return getValidPositions(tripData);
                })
                .then(function() {
                    document.querySelector("#tripPlay_body").style.display = "block";
                    player.init(tripId, tripLogs);
                }).catch(showError)
                .finally(waiting.stop);
        },
        applyOptions = function(options, needTrips) {
            if(!options.devices || !options.trips || !options.datePicker) {
                return false;
            }

            if(typeof options.devicesFilter === "string") {
                loadDevicesContent(options.devicesFilter, true);
                return false;
            }

            // We need to remove current state before setting new state (setState method ussues)
            state.setState({
                datePicker: null,
                devices: null,
                trips: null
            });

            state.setState({
                datePicker: options.datePicker,
                devices: options.devices,
                trips: options.trips
            });

            if(needTrips) {
                loadTripsContent(options.devices, options.datePicker.start, options.datePicker.end);
                return false;
            }

            if(options.trips.length) {
                if(!currTrip || currTrip !== options.trips[0]) {
                    player.unload();
                    loadTripPoints(options.trips[0]);
                    currTrip = options.trips[0];
                }
            } else {
                optionsToolbar.setSelected(options);
                player.unload();
                currTrip = null;
                document.querySelector("#tripPlay_body").style.display = "none";
            }
        },
        showError = function(e) {
            console.error(e);
        };

    return {
        initialize: function(api, state, callback) {
            initialize();

            if (callback) {
                callback();
            }
        },
        focus: function(api, state) {
            var options = state.getState();
            optionsToolbar.setOptions(options);
            if(options.devices && options.devices.length) {
                getSelectedDevices(options.devices);
            }
            if(options.trips && options.trips.length) {
                getSelectedTrip(options.trips);
            }
            loadDevicesContent();
        },
        blur: function() {
            player.unload();
            optionsToolbar.unload();
            currTrip = null;
        }
    };
};