var tripPlayAddin = tripPlayAddin || {};

tripPlayAddin.player = (function(){
    "use strict";

    function classNameCtrl(el){
        var param = typeof el.className === "string" ? "className" : "baseVal";
        return {
            get: function(){
                return el[param] || '';
            },
            set: function(text){
                el[param] = text;
            }
        };
    }

    function removeClass(el, name) {
        if(!el) {
            return false;
        }
        var classesStr = classNameCtrl(el).get(),
            classes = classesStr.split(" "),
            newClasses = classes.filter(function(classItem){
                return (classItem !== name);
            });
        classNameCtrl(el).set(newClasses.join(" "));
    }

    function addClass(el, name) {
        if(!el) {
            return false;
        }
        var classesStr = classNameCtrl(el).get(),
            classes = classesStr.split(" ");
        if(classes.indexOf(name) === -1) {
            classNameCtrl(el).set(classesStr + " " + name);
            return true;
        }
        return false;
    }

    function hasClass(el, name) {
        if(!el) {
            return false;
        }
        var classesStr = classNameCtrl(el).get() || "",
            classes = classesStr.split(" ");
        return classes.indexOf(name) > -1;
    }

    var map,
        panorama,
        sv,
        playing,
        prevPanos = [],
        controls,
        controlButtons,
        currPoint = 0,
        points = [],
        tripPath,
        playPaused = false,
        playTechPaused = false,
        lastPano, firstPano,
        startMarker, finishMarker,
        povMarker,
        loadPanoCallback,
        loadPanoId,
        panoCont,
        waiting = tripPlayAddin.waiting(),
        config = {
            zoom: 3,
            preloadImages: false,
            frameDuration: 500,
            mapDim: {
                width: 300,
                height: 300
            },
            mapBigDim: {
                width: "80%",
                height: "80%"
            },
            pathInterval: 0.0001
        },
        applyStyles = function(el, styles) {
            Object.keys(styles).forEach(function(style){
                el.style[style] = styles[style];
            });
        },
        initSV = function() {
            sv = new google.maps.StreetViewService();
        },
        initPanorama = function() {
            var mapPreCont = document.createElement("DIV");

            applyStyles(mapPreCont, {
                width: panoCont.offsetWidth,
                height: panoCont.offsetHeight,
                visibility: "hidden",
                top: 0,
                left: 0
            });

            if(!panorama) {
                panorama = new google.maps.StreetViewPanorama(panoCont);
            }
            panorama.setOptions({
                disableDefaultUI: true,
                scrollwheel: false
            });

            panorama.addListener("status_changed", function(){
                var markerIcon,
                    pano = panorama.getPano();
                if(povMarker && panorama.getStatus() === "OK") {
                    if(loadPanoId === panorama.getPano()){ // If panorama hasn't changed yet
                        markerIcon = povMarker.getIcon();
                        markerIcon.rotation = panorama.getPov().heading;
                        povMarker.setIcon(markerIcon);
                        povMarker.setPosition(panorama.getPosition());
                    }
                    if(loadPanoCallback){
                        loadPanoCallback(pano); // Execute callback from processSVData
                    }
                }
            });

            setPanoSize();
            window.addEventListener("resize", setPanoSize, false);
        },
        setPanoSize = function(){
            panoCont.style.height = document.body.offsetHeight - panoCont.getBoundingClientRect().top + "px";
        },
        init = function(id, logs) {
            controls = document.querySelector("#tripPlay_controlsWindow");
            panoCont = document.querySelector("#tripPlay_pano");
            unload();
            points = logs;
            controlButtons = {
                play: document.querySelector("#controlPlay"),
                stop: document.querySelector("#controlStop"),
                pause: document.querySelector("#controlPause"),
                forward: document.querySelector("#controlNext"),
                back: document.querySelector("#controlPrev")
            };

            // If google hasn't been init yet
            if(!sv) {
                return false;
            }

            initControls();
            initMapWndButtons();
            initEvents();
            initPanorama();

            waiting.start(document.querySelector("#tripPlay_body"));
            initMap(points);
            stop();
            getSVData(points, points.length - 1, true).then(function(svData){
                lastPano = svData;
                return getSVData(points, 0, false);
            }).then(function(svData){
                firstPano = svData;
                waiting.stop();
                if(!lastPano || !firstPano || lastPano === firstPano) {
                    panoCont.textContent = "There are no panoramas for this trip";
                    toggleControls(false);
                    return false;
                }
                currPoint = svData.pointIndex || 0;
                showFrame(svData);
                toggleControls(true);
            });
        },
        onBlurTab = function(){
            pause(true);
        },
        initEvents = function(){
            window.removeEventListener("blur", onBlurTab, false);
            window.addEventListener("blur", onBlurTab, false);
        },
        getSVData = function(points, pointIndex, isBack){
            return new Promise(function(resolve, reject){
                if(pointIndex >= points.length || pointIndex < 0) {
                    return resolve();
                }

                var point = points[pointIndex],
                    location = {
                        lat: point.latitude,
                        lng: point.longitude
                    },
                    heading = calculateDirection(points, pointIndex),
                    pov;
                if(heading !== false) {
                    pov = {
                        heading: heading,
                        pitch: 0
                    };
                }
                sv.getPanorama({location: location, radius: 50, source: "outdoor"}, function(data, status){
                    var svData;
                    if(status === google.maps.StreetViewStatus.OK) {
                        svData = {
                            pano: data.location.pano,
                            position: data.location.latLng,
                            status: status,
                            pov: pov,
                            isBack: isBack
                        };
                        svData.pointIndex = pointIndex;
                        return resolve(svData);
                    } else {
                        getSVData(points, (isBack) ? pointIndex - 1 : pointIndex + 1, isBack).then(function(svData){
                            resolve(svData);
                        });
                    }
                });
            });
        },
        getNextSVData = function(isBack, panoPoint){
            var direction ,
                linksData,
                link;
            panoPoint = panoPoint || panorama.getPosition();
            direction = calculateDirection(points, currPoint, {
                latitude: panoPoint.lat(),
                longitude: panoPoint.lng()
            }, isBack);
            linksData = panorama.getLinks();
            link = getClosestLink(linksData, direction);

            return new Promise(function(resolve, reject){
                if(link) {
                    return resolve({
                        pano: link.pano,
                        status: "OK",
                        pov: {
                            heading: (isBack) ? getOppositDirection(link.heading) : link.heading,
                            pitch: 0
                        }
                    });
                } else {
                    if(currPoint < points.length && currPoint >= 0) {
                        currPoint += (isBack) ? -1 : 1;
                        getSVData(points, currPoint, isBack).then(function(svData){
                            return resolve(svData);
                        });
                    }
                }
            });
        },
        getClosestLink = function(links, heading) {
            return links.reduce(function(closest, link){
                var currDelta = Math.abs(link.heading - heading),
                    closestDelta = Math.abs(closest.heading - heading);
                if(currDelta > 180) {
                    currDelta = 360 - currDelta;
                }
                if(closestDelta > 180) {
                    closestDelta = 360 - closestDelta;
                }
                if(currDelta < closestDelta || (currDelta === closestDelta && link.description)) {
                    return link;
                }
                return closest;
            }, links[0]);
        },
        initControls = function() {
            controlButtons.play.addEventListener("click", play, false);
            controlButtons.pause.addEventListener("click", pause, false);
            controlButtons.stop.addEventListener("click", stop, false);
            controlButtons.forward.addEventListener("click", fw, false);
            controlButtons.back.addEventListener("click", rw, false);
            document.addEventListener("keyup", processPlayerKey, false);
        },
        toggleControls = function(isShow){
            if(controls) {
                applyStyles(controls, {display: (isShow) ? "inline-block" : "none"});
            }
        },
        processPlayerKey = function(e){
            e.preventDefault();
            var keyCode = e.which || e.keyCode;
            switch(keyCode) {
                case 19:
                case 32:
                    (playing) ? pause() : play();
                    break;
                case 35:
                case 36:
                    stop();
                    break;
                case 34:
                case 37:
                    rw();
                    break;
                case 33:
                case 39:
                    fw();
                    break;
            }
        },
        initMap = function(points) {
            var mapParams = getMapParams(points),
                coordinates = points.map(function(point){
                    return {
                        lat: point.latitude,
                        lng: point.longitude
                    };
                }),
                carIcon = {
                    path: 'm23.9102,83.5464c-0.1075,-0.0134 -0.2054,-0.1763 -0.2133,-0.37341c0.0079,-0.2053 0.1058,-0.3679 0.2133,-0.3733c0.1342,0.0054 0.2321,0.168 0.24,0.3733c-0.0079,0.19711 -0.1058,0.36 -0.24,0.37341zm0,0c-0.1075,-0.0134 -0.2054,-0.1763 -0.2133,-0.37341c0.0079,-0.2053 0.1058,-0.3679 0.2133,-0.3733c0.1342,0.0054 0.2321,0.168 0.24,0.3733c-0.0079,0.19711 -0.1058,0.36 -0.24,0.37341m0,-0.1067c-0.1693,0.0045 -0.3172,-0.3973 -0.32,-0.88c0.0028,-0.5085 0.1507,-0.9106 0.32,-0.9067c0.196,-0.004 0.344,0.3981 0.3467,0.9067c-0.0027,0.4827 -0.1507,0.8845 -0.3467,0.88zm0,0c-0.1693,0.0045 -0.3172,-0.3973 -0.32,-0.88c0.0028,-0.5085 0.1507,-0.9106 0.32,-0.9067c0.196,-0.004 0.344,0.3981 0.3467,0.9067c-0.0027,0.4827 -0.1507,0.8845 -0.3467,0.88m0,0.1067l0,6.4m-18.0533,-21.04c-0.05413,-2.8344 -0.04266,-7.8262 -0.02666,-13.12c0,0 -0.00134,-9.4635 0,-11.8667c0.07733,0.0562 0.15973,0.1026 0.24,0.16c0.23573,1.1186 1.14667,5.5733 1.14667,5.5733l0.48,2.3467c0.74054,3.5915 1.02134,6.5138 1.12,11.5733c0.0432,2.3258 0.0528,4.7915 0.05334,6.88c-1.1456,-0.4747 -2.18187,-1.01231 -3.01334,-1.5467l-0.00001,0.0001zm0,0c-0.05413,-2.8344 -0.04266,-7.8262 -0.02666,-13.12c0,0 -0.00134,-9.4635 0,-11.8667c0.07733,0.0562 0.15973,0.1026 0.24,0.16c0.23573,1.1186 1.14667,5.5733 1.14667,5.5733l0.48,2.3467c0.74054,3.5915 1.02134,6.5138 1.12,11.5733c0.0432,2.3258 0.0528,4.7915 0.05334,6.88c-1.1456,-0.4747 -2.18187,-1.01231 -3.01334,-1.5467m2.05333,12.13329c-0.284,0.71931 -0.79279,1.9558 -1.12,2.69341c-0.15974,-0.0632 -0.30213,-0.133 -0.4,-0.1866c-0.20667,-3.1108 -0.38267,-7.1673 -0.48,-11.44l2.93333,1.0399c-0.0112,1.3976 -0.07999,2.9867 -0.07999,2.9867c-0.07681,1.91869 -0.24054,3.268 -0.85334,4.90659zm0,0c-0.284,0.71931 -0.79279,1.9558 -1.12,2.69341c-0.15974,-0.0632 -0.30213,-0.133 -0.4,-0.1866c-0.20667,-3.1108 -0.38267,-7.1673 -0.48,-11.44l2.93333,1.0399c-0.0112,1.3976 -0.07999,2.9867 -0.07999,2.9867c-0.07681,1.91869 -0.24054,3.268 -0.85334,4.90659m34.07996,-12.13329c0.0541,-2.8344 0.0428,-7.8261 0.0267,-13.1199c0,0 0.0014,-9.4636 0,-11.8667c-0.0773,0.0562 -0.1597,0.1026 -0.24,0.16c-0.2357,1.1186 -1.1467,5.5733 -1.1467,5.5733l-0.48,2.3467c-0.7405,3.5914 -1.0212,6.5138 -1.12,11.5733c-0.0431,2.3258 -0.0528,4.7915 -0.0533,6.88c1.1456,-0.4747 2.182,-1.01231 3.0133,-1.5467l0,0zm0,0c0.0541,-2.8344 0.0428,-7.8261 0.0267,-13.1199c0,0 0.0014,-9.4636 0,-11.8667c-0.0773,0.0562 -0.1597,0.1026 -0.24,0.16c-0.2357,1.1186 -1.1467,5.5733 -1.1467,5.5733l-0.48,2.3467c-0.7405,3.5914 -1.0212,6.5138 -1.12,11.5733c-0.0431,2.3258 -0.0528,4.7915 -0.0533,6.88c1.1456,-0.4747 2.182,-1.01231 3.0133,-1.5467m-2.0533,12.13329c0.2839,0.71931 0.7928,1.9558 1.12,2.69341c0.1598,-0.0632 0.3022,-0.1331 0.4,-0.1867c0.2068,-3.1107 0.3827,-7.16721 0.48,-11.44l-2.9333,1.04c0.0112,1.3976 0.08,2.9866 0.08,2.9866c0.0767,1.9188 0.2405,3.2681 0.8533,4.9067l0,0zm0,0c0.2839,0.71931 0.7928,1.9558 1.12,2.69341c0.1598,-0.0632 0.3022,-0.1331 0.4,-0.1867c0.2068,-3.1107 0.3827,-7.16721 0.48,-11.44l-2.9333,1.04c0.0112,1.3976 0.08,2.9866 0.08,2.9866c0.0767,1.9188 0.2405,3.2681 0.8533,4.9067m-16.0267,-78.37326c-0.4291,-0.00989 -0.7878,-0.07281 -0.8,-0.18671c0.0122,-0.11652 0.3709,-0.20984 0.8,-0.21332c0.4559,0.00348 0.8145,0.0968 0.8267,0.21332c-0.0122,0.11389 -0.3708,0.17682 -0.8267,0.18671zm0,0c-0.4291,-0.00989 -0.7878,-0.07281 -0.8,-0.18671c0.0122,-0.11652 0.3709,-0.20984 0.8,-0.21332c0.4559,0.00348 0.8145,0.0968 0.8267,0.21332c-0.0122,0.11389 -0.3708,0.17682 -0.8267,0.18671m0,0.29333c-0.6362,0.00049 -1.1627,-0.14563 -1.1733,-0.32001c0.0106,-0.1864 0.5371,-0.33252 1.1733,-0.32001c0.6628,-0.01251 1.1892,0.13361 1.2,0.32001c-0.0108,0.17438 -0.5372,0.3205 -1.2,0.32001zm0,0c-0.6362,0.00049 -1.1627,-0.14563 -1.1733,-0.32001c0.0106,-0.1864 0.5371,-0.33252 1.1733,-0.32001c0.6628,-0.01251 1.1892,0.13361 1.2,0.32001c-0.0108,0.17438 -0.5372,0.3205 -1.2,0.32001m-1.7066,-1.46667c0.4013,-0.29016 1.1602,-0.50879 1.7066,-0.50665c0.5732,-0.00214 1.332,0.21649 1.7334,0.50665m-3.8934,0.53333c0.4863,-0.41998 1.5098,-0.62854 2.16,-0.64001c0.6769,0.01147 1.7005,0.22003 2.1867,0.64001m-4.5866,0.45331c0.6779,-0.33008 1.5334,-0.51306 2.3999,-0.50665c0.8933,-0.00641 1.7488,0.17657 2.4267,0.50665m-23.43998,60.74666c0.18853,0.2976 0.30534,0.7827 0.29333,1.36c0.012,0.5517 -0.0568,0.979 -0.21333,1.30669m41.97338,-2.6667c-0.1886,0.2976 -0.3053,0.7827 -0.2934,1.36c-0.0119,0.5517 0.0567,0.979 0.2134,1.30669m-41.89337,0c-0.13227,0.5405 -0.43094,0.84451 -0.74667,1.01331m42.64004,-1.01331c0.1321,0.5405 0.431,0.84451 0.7466,1.01331m-42.63997,-1.01331c-0.00694,0.8904 -0.03627,1.68771 -0.10667,2.1067c-0.35387,-0.1622 -0.5872,-0.5456 -0.64,-1.0667c-0.09627,-0.8118 -0.1416,-2.9504 -0.05334,-3.8133c0.0696,-0.5078 0.30293,-0.9347 0.58667,-1.0934c0.0616,0.2438 0.1056,0.6747 0.13333,1.2c-0.26373,0.2328 -0.32747,0.5221 -0.34666,0.9067c0.00453,0.3827 -0.00267,0.8677 0.02666,1.17329c0.0144,0.31651 0.1376,0.4688 0.4,0.5867l0.00001,0l0,0zm41.89337,0c0.007,0.8904 0.0363,1.68771 0.1066,2.1067c0.3539,-0.1622 0.5873,-0.5456 0.64,-1.0667c0.0964,-0.8118 0.1416,-2.9504 0.0534,-3.8133c-0.0696,-0.5078 -0.3031,-0.9347 -0.5867,-1.0934c-0.0617,0.2438 -0.1056,0.6747 -0.1333,1.2c0.2638,0.2328 0.3274,0.5221 0.3466,0.9067c-0.0046,0.3827 0.0026,0.8677 -0.0266,1.17329c-0.0144,0.31651 -0.1375,0.4688 -0.4,0.5867l0,0l0,0zm-39.9467,-23.12c-0.1808,-0.8464 -0.43973,-1.6808 -1.17333,-1.8667c1.012,-0.724 0.59493,-2.28 1.30666,-2.7467c0.244,1.1336 0.5648,3.0241 0.50667,4.5334l-0.64,0.08l0,0zm0,0c-0.1808,-0.8464 -0.43973,-1.6808 -1.17333,-1.8667c1.012,-0.724 0.59493,-2.28 1.30666,-2.7467c0.244,1.1336 0.5648,3.0241 0.50667,4.5334l-0.64,0.08m38,0c0.1807,-0.8464 0.4398,-1.6808 1.1733,-1.8667c-1.0118,-0.724 -0.595,-2.28 -1.3066,-2.7467c-0.244,1.1337 -0.5649,3.0241 -0.5067,4.5334l0.64,0.08l0,0zm0,0c0.1807,-0.8464 0.4398,-1.6808 1.1733,-1.8667c-1.0118,-0.724 -0.595,-2.28 -1.3066,-2.7467c-0.244,1.1337 -0.5649,3.0241 -0.5067,4.5334l0.64,0.08m-38,0c-0.1808,-0.8464 -0.43973,-1.6808 -1.17333,-1.8667c-0.11813,-0.0416 -0.23627,-0.057 -0.37333,-0.0533c-1.68481,-0.0037 -3.05867,2.3155 -3.33334,3.3333c-0.104,0.4201 -0.0592,0.8566 0.42667,0.6934c0.49173,-0.1478 4.09173,-1.4515 4.45333,-2.1067zm0,0c-0.1808,-0.8464 -0.43973,-1.6808 -1.17333,-1.8667c-0.11813,-0.0416 -0.23627,-0.057 -0.37333,-0.0533c-1.68481,-0.0037 -3.05867,2.3155 -3.33334,3.3333c-0.104,0.4201 -0.0592,0.8566 0.42667,0.6934c0.49173,-0.1478 4.09173,-1.4515 4.45333,-2.1067m38,0c0.1807,-0.8464 0.4398,-1.6808 1.1733,-1.8667c0.1182,-0.0416 0.2363,-0.057 0.3734,-0.0533c1.6846,-0.0037 3.0586,2.3155 3.3333,3.3333c0.1039,0.4201 0.0592,0.8566 -0.4267,0.6934c-0.4917,-0.1478 -4.0916,-1.4515 -4.4533,-2.1067zm0,0c0.1807,-0.8464 0.4398,-1.6808 1.1733,-1.8667c0.1182,-0.0416 0.2363,-0.057 0.3734,-0.0533c1.6846,-0.0037 3.0586,2.3155 3.3333,3.3333c0.1039,0.4201 0.0592,0.8566 -0.4267,0.6934c-0.4917,-0.1478 -4.0916,-1.4515 -4.4533,-2.1067m-37.89333,56.24c0.64827,4.572 3.24773,7.485 5.25333,8.32c0.4176,0.18 0.5515,0.363 0.72,0.587c0.2544,0.334 0.4139,0.771 -0.0267,0.64c-3.32663,-0.973 -5.97037,-4.063 -6.29329,-9.467c-0.02053,-0.5095 0.28827,-0.4888 0.34666,-0.08zm0,0c0.64827,4.572 3.24773,7.485 5.25333,8.32c0.4176,0.18 0.5515,0.363 0.72,0.587c0.2544,0.334 0.4139,0.771 -0.0267,0.64c-3.32663,-0.973 -5.97037,-4.063 -6.29329,-9.467c-0.02053,-0.5095 0.28827,-0.4888 0.34666,-0.08m37.78663,0c-0.6483,4.572 -3.2478,7.485 -5.2533,8.32c-0.4175,0.18 -0.5516,0.363 -0.72,0.587c-0.2544,0.334 -0.4138,0.771 0.0267,0.64c3.3266,-0.973 5.9705,-4.063 6.2933,-9.467c0.0206,-0.5095 -0.2883,-0.4888 -0.3467,-0.08l0,0zm0,0c-0.6483,4.572 -3.2478,7.485 -5.2533,8.32c-0.4175,0.18 -0.5516,0.363 -0.72,0.587c-0.2544,0.334 -0.4138,0.771 0.0267,0.64c3.3266,-0.973 5.9705,-4.063 6.2933,-9.467c0.0206,-0.5095 -0.2883,-0.4888 -0.3467,-0.08m-36.42664,-89.3867c-0.98053,2.4006 -1.9216,8.103 -1.92,13.8934c-0.0016,5.8141 0.0656,8.4819 0.26667,13.8933m36.71997,-27.7867c0.9806,2.4006 1.9217,8.103 1.92,13.8934c0.0017,5.8141 -0.0656,8.4819 -0.2666,13.8933m-24,-34.21334c-3.9534,5.95947 -10.09283,19.50934 -12.96003,31.01334m22.58663,-31.01334c3.9534,5.95947 10.0929,19.50934 12.96,31.01334m-23.7066,-30.61337c0.1677,-0.25226 0.1693,-0.49866 0.16,-0.66663c0.0093,-0.14319 -0.0355,-0.27039 -0.3734,-0.21332c-0.7939,0.17035 -1.9477,0.42584 -3.3866,0.82666c0.0271,0.33276 -0.0329,0.85999 -0.1867,1.22662c1.0501,-0.23334 2.4656,-0.56586 3.2533,-0.82666c0.3176,-0.10107 0.4339,-0.2005 0.5333,-0.34668l0.0001,0.00001zm0,0c0.1677,-0.25226 0.1693,-0.49866 0.16,-0.66663c0.0093,-0.14319 -0.0355,-0.27039 -0.3734,-0.21332c-0.7939,0.17035 -1.9477,0.42584 -3.3866,0.82666c0.0271,0.33276 -0.0329,0.85999 -0.1867,1.22662c1.0501,-0.23334 2.4656,-0.56586 3.2533,-0.82666c0.3176,-0.10107 0.4339,-0.2005 0.5333,-0.34668m11.8667,0c-0.1677,-0.25226 -0.1693,-0.49866 -0.16,-0.66663c-0.0093,-0.14319 0.0355,-0.27039 0.3733,-0.21332c0.7939,0.17035 1.9476,0.42584 3.3867,0.82666c-0.0272,0.33276 0.0329,0.85999 0.1867,1.22662c-1.0502,-0.23334 -2.4657,-0.56586 -3.2533,-0.82666c-0.3178,-0.10107 -0.4339,-0.2005 -0.5334,-0.34668l0,0.00001zm0,0c-0.1677,-0.25226 -0.1693,-0.49866 -0.16,-0.66663c-0.0093,-0.14319 0.0355,-0.27039 0.3733,-0.21332c0.7939,0.17035 1.9476,0.42584 3.3867,0.82666c-0.0272,0.33276 0.0329,0.85999 0.1867,1.22662c-1.0502,-0.23334 -2.4657,-0.56586 -3.2533,-0.82666c-0.3178,-0.10107 -0.4339,-0.2005 -0.5334,-0.34668m-15.6533,1.17334c0.1539,-0.36664 0.2139,-0.89386 0.1867,-1.22662c-0.0006,-0.14508 -0.1576,-0.15631 -0.32,-0.10669c-1.1832,0.3515 -2.1867,0.7373 -2.9867,1.12c-2.69573,1.29626 -4.43654,3.23895 -5.12,4.93335c-0.06107,0.13281 0.31866,0.28345 0.42667,0.1333c0.8568,-1.15649 1.1144,-1.34424 1.94667,-1.86664c0.97173,-0.60132 2.52586,-1.20959 3.35996,-1.44c1.0299,-0.26294 1.7459,-0.62854 2.5067,-1.54669l0,-0.00001zm0,0c0.1539,-0.36664 0.2139,-0.89386 0.1867,-1.22662c-0.0006,-0.14508 -0.1576,-0.15631 -0.32,-0.10669c-1.1832,0.3515 -2.1867,0.7373 -2.9867,1.12c-2.69573,1.29626 -4.43654,3.23895 -5.12,4.93335c-0.06107,0.13281 0.31866,0.28345 0.42667,0.1333c0.8568,-1.15649 1.1144,-1.34424 1.94667,-1.86664c0.97173,-0.60132 2.52586,-1.20959 3.35996,-1.44c1.0299,-0.26294 1.7459,-0.62854 2.5067,-1.54669m19.44,0c-0.1538,-0.36664 -0.2139,-0.89386 -0.1867,-1.22662c0.0007,-0.14508 0.1577,-0.15631 0.32,-0.10669c1.1831,0.3515 2.1868,0.7373 2.9867,1.12c2.6955,1.29626 4.4364,3.23895 5.12,4.93335c0.061,0.13281 -0.3185,0.28345 -0.4267,0.1333c-0.8566,-1.15649 -1.1142,-1.34424 -1.9466,-1.86664c-0.9717,-0.60132 -2.5259,-1.20959 -3.36,-1.44c-1.0298,-0.26294 -1.7459,-0.62854 -2.5067,-1.54669l0,-0.00001zm0,0c-0.1538,-0.36664 -0.2139,-0.89386 -0.1867,-1.22662c0.0007,-0.14508 0.1577,-0.15631 0.32,-0.10669c1.1831,0.3515 2.1868,0.7373 2.9867,1.12c2.6955,1.29626 4.4364,3.23895 5.12,4.93335c0.061,0.13281 -0.3185,0.28345 -0.4267,0.1333c-0.8566,-1.15649 -1.1142,-1.34424 -1.9466,-1.86664c-0.9717,-0.60132 -2.5259,-1.20959 -3.36,-1.44c-1.0298,-0.26294 -1.7459,-0.62854 -2.5067,-1.54669m-9.7334,-2.15997c-0.8242,-0.00879 -1.6949,0.01837 -2.5333,0.08002c-0.0608,0.19702 -0.0058,0.34106 0.32,0.34662c0.426,0.00854 0.7872,0.02539 0.9867,0.08002c0.2207,0.07867 0.6493,0.1955 1.2266,0.18671l0.0267,0c0.5774,0.00879 1.006,-0.10803 1.2267,-0.18671c0.1995,-0.05463 0.5607,-0.07147 0.9866,-0.08002c0.326,-0.00555 0.3809,-0.1496 0.32,-0.34662c-0.8383,-0.06165 -1.709,-0.08881 -2.56,-0.08002l0,0zm0,0c-0.8242,-0.00879 -1.6949,0.01837 -2.5333,0.08002c0.7123,-1.37042 1.5936,-2.08722 2.5333,-2.08002l0.0267,0c0.9398,-0.0072 1.8211,0.70959 2.5333,2.08002c-0.8383,-0.06165 -1.709,-0.08881 -2.56,-0.08002zm19.8134,96.8267c-0.3012,-0.0496 -0.4043,-0.9062 -0.24,-1.8933c0.188,-1.0037 0.5763,-1.7614 0.88,-1.7068c0.3014,0.0669 0.4038,0.9238 0.24,1.9201c-0.1884,0.995 -0.5765,1.75291 -0.88,1.68l0,0zm-19.8134,5.70631c-6.569,-0.00301 -12.6338,-4.496 -15.62661,-9.11961c0.7632,-4.84669 1.78671,-8.42509 2.16001,-9.2801c0.3888,-0.8346 1.0882,-0.9994 1.76,-0.88c2.9533,0.5344 6.0562,0.8675 11.7066,0.88c5.677,-0.0125 8.78,-0.3456 11.7334,-0.88c0.6717,-0.1194 1.3712,0.04539 1.76,0.88c0.3732,0.855 1.3969,4.4334 2.16,9.2801c-2.9927,4.6236 -9.0576,9.1166 -15.6534,9.11961l0,0zm0,-55.3863c-5.0341,-0.0059 -9.7951,0.5189 -13.28,1.2533c-0.625,0.128 -0.90982,-0.0963 -1.03994,-0.6133c-0.81947,-2.8587 -2.63441,-9.6947 -3.17334,-12.5334c-0.15893,-0.8394 -0.33707,-2.369 0.10667,-3.2533c1.84373,-3.7787 9.84321,-5.7493 17.38671,-5.76c7.5701,0.0107 15.5694,1.9813 17.4133,5.76c0.4437,0.8843 0.2655,2.4139 0.1067,3.2533c-0.5389,2.8387 -2.354,9.6747 -3.1734,12.5334c-0.1301,0.517 -0.415,0.7413 -1.04,0.6133c-3.4848,-0.7344 -8.2459,-1.2592 -13.3067,-1.2533zm0,63.3333c-10.2101,0.004 -12.7194,-1.927 -13.91995,-3.60001c-3.57226,-2.42799 -5.58906,-6.13 -6.50667,-8.587c-0.66212,-0.811 -1.2848,-1.9085 -1.38667,-3.3064c-0.24986,-3.4756 -0.38506,-14.141 0.02667,-17.7333c0.1344,-1.28291 0.36186,-1.8144 0.29333,-3.78661c-0.30106,-8.83099 -0.36826,-28.739 -0.21333,-38.8c0.048,-2.1102 -0.4544,-3.211 -0.48,-5.04c-0.0416,-1.8363 -0.0784,-12.8099 0.37333,-15.2534c0.35307,-1.8296 1.4824,-3.7256 2.53333,-6.32c1.50027,-3.77415 2.7536,-5.36186 5.25334,-6.69334c2.17602,-1.15387 7.32772,-2.53815 10.56002,-3.09332c0.4648,-0.07092 0.8304,-0.224 1.3066,-0.45331c0.4651,-0.23761 1.2045,-0.43762 2.16,-0.4267c0.9822,-0.01093 1.7217,0.18909 2.1867,0.4267c0.4763,0.22931 0.842,0.38239 1.3067,0.45331c3.2322,0.55518 8.3839,1.93945 10.56,3.09332c2.4998,1.33148 3.7531,2.91919 5.2533,6.69334c1.0508,2.5944 2.1802,4.4904 2.5333,6.32c0.4517,2.4435 0.415,13.4171 0.3734,15.2534c-0.0256,1.829 -0.5279,2.9298 -0.48,5.04c0.155,10.061 0.0878,29.969 -0.2134,38.8c-0.0685,1.97221 0.1589,2.5037 0.2934,3.78661c0.4117,3.5923 0.2766,14.2577 0.0266,17.7333c-0.1017,1.3979 -0.7245,2.4954 -1.3866,3.3064c-0.9177,2.457 -2.9344,6.159 -6.5067,8.587c-1.2005,1.673 -3.7099,3.604 -13.9467,3.60001l0,0l0,0z',
                    fillColor: 'yellow',
                    fillOpacity: 0.8,
                    scale: 0.4,
                    anchor: {x:25, y:0},
                    labelOrigin: {x:25, y:0}
                },
                pauseState = null;

            if(panorama && panorama.getStatus() === "OK") {
                carIcon.rotation = panorama.getPov().heading;
                carIcon.position = panorama.getPosition();
            }

            if(!map) {
                map = new google.maps.Map(document.querySelector("#tripPlay_map"));
            }
            map.setOptions({
                zoom: mapParams.zoom,
                center: mapParams.center,
                mapTypeId: google.maps.MapTypeId.ROADMAP,
                disableDefaultUI: true
            });

            if(!tripPath) {
                tripPath = new google.maps.Polyline();
                tripPath.setMap(map);
            }
            tripPath.setOptions({
                path: coordinates,
                geodesic: true,
                strokeColor: "#FF0000",
                strokeOpacity: 1.0,
                strokeWeight: 2
            });

            if(!startMarker) {
                startMarker = new google.maps.Marker();
                startMarker.setMap(map);
            }
            startMarker.setOptions({
                position: coordinates[0],
                label: "A"
            });

            if(!finishMarker) {
                finishMarker = new google.maps.Marker();
                finishMarker.setMap(map);
            }
            finishMarker.setOptions({
                position: coordinates[coordinates.length - 1],
                label: "B"
            });

            if(!povMarker) {
                povMarker = new google.maps.Marker();
                povMarker.setMap(map);
                povMarker.addListener("drag", function() {
                    if(pauseState === null) {
                        pauseState = playPaused;
                    }
                    pause(true);
                    if(!tripPath) {
                        return false;
                    }
                    var povMarkerPosition = povMarker.getPosition(),
                        closestPoint = getClosestPathPoint(tripPath, povMarkerPosition);
                    povMarker.setPosition({lat: points[closestPoint].latitude, lng: points[closestPoint].longitude});
                    currPoint = closestPoint;
                });

                povMarker.addListener("dragend", function() {
                    getSVData(points, currPoint, false).then(function(svData){
                        if(!svData) {
                            return false;
                        }
                        currPoint = svData.pointIndex;
                        showFrame(svData).then(function(){
                            prevPanos = [];
                            currPoint = svData.pointIndex || currPoint;
                            pause(pauseState);
                            pauseState = null;
                        });
                    }).catch(function() {
                        povMarker.setPosition(panorama.getPosition());
                    });
                });
            }
            povMarker.setOptions({
                position: coordinates[currPoint || 0],
                label: "X",
                draggable: true,
                zIndex: 999,
                icon: carIcon
            });
            window.removeEventListener("resize", resizeMap, false);
            window.addEventListener("resize", resizeMap, false);
        },
        getClosestPathPoint = function(path, point) {
            var closestPointIndex = 0,
                minDistance = null,
                pathPoints = path.getPath();
            pathPoints.forEach(function(currPathPoint, index){
                var toPointDistance = google.maps.geometry.spherical.computeDistanceBetween(currPathPoint, point);
                if(minDistance === null || toPointDistance < minDistance) {
                    minDistance = toPointDistance;
                    closestPointIndex = index;
                }
            });
            return closestPointIndex;
        },
        initMapWndButtons = function() {
            var mapWnd = document.querySelector("#tripPlay_mapWindow"),
                mapCont = document.getElementById("tripPlay_map"),
                sizeBtn = document.querySelector("#tripPlay_mapWindowSize"),
                hideBtn = document.querySelector("#tripPlay_mapWindowHide");
            sizeBtn.removeEventListener("click", sizeMapBtnEventListener, false);
            sizeBtn.addEventListener("click", sizeMapBtnEventListener, false);
            hideBtn.removeEventListener("click", hideMapBtnEventListener, false);
            hideBtn.addEventListener("click", hideMapBtnEventListener, false);

            applyStyles(mapWnd, {display: "block"});

            mapWnd.expand = function(){
                removeClass(mapWnd, "collapsed");
                google.maps.event.trigger(map, "resize");
                initMap(points);
            };

            mapWnd.collapse = function(){
                addClass(mapWnd, "collapsed");
                google.maps.event.trigger(map, "resize");
            };

            mapWnd.setSize = function(isUp){
                var mapSize = getMapSize((isUp) ? config.mapBigDim : config.mapDim);
                if(mapCont.style.width === mapSize.width + "px" && mapCont.style.height === mapSize.height + "px") {
                    return false;
                }
                if(isUp) {
                    addClass(mapWnd, "tripPlay_big-size");
                } else {
                    removeClass(mapWnd, "tripPlay_big-size");
                }
                applyStyles(mapCont, {
                    width: mapSize.width + "px",
                    height: mapSize.height + "px"
                });
                google.maps.event.trigger(map, "resize");
                initMap(points);
            };
        },
        resizeMap = function() {
            var mapWnd = document.querySelector("#tripPlay_mapWindow");
            mapWnd.setSize(hasClass(mapWnd, "tripPlay_big-size"));
        },
        getMapSize = function(sizes){
            var width = calculateMapDimParam(sizes.width, "x"),
                height = calculateMapDimParam(sizes.height, "y");
            return {
                width: width,
                height: height
            };
        },
        calculateMapDimParam = function(value, type) {
            if(!isNaN(value)) {
                return value;
            }
            var mapCont = document.querySelector("#tripPlay_mapWindow > .tripPlay_body"),
                fullScreen = (type === "x") ? document.body.offsetWidth - mapCont.getBoundingClientRect().left
                    : document.body.offsetHeight - mapCont.getBoundingClientRect().top;
            if(value.indexOf("%") > -1) {
                return fullScreen * parseFloat(value.replace("%", "")) / 100;
            } else {
                return 300;
            }
        },
        hideMapBtnEventListener = function() {
            var mapWnd = document.querySelector("#tripPlay_mapWindow");
            mapWnd[hasClass(mapWnd, "collapsed") ? "expand" : "collapse"]();
        },
        sizeMapBtnEventListener = function() {
            var mapWnd = document.querySelector("#tripPlay_mapWindow");
            mapWnd.setSize(!hasClass(mapWnd, "tripPlay_big-size"));
        },
        getMapParams = function(points) {
            var minX = points[0].longitude,
                maxX = points[0].longitude,
                minY = points[0].latitude,
                maxY = points[0].latitude,
                maxZoom = 16,
                zoomX, zoomY,
                zoom,
                mapWnd = document.querySelector("#tripPlay_mapWindow"),
                mapSize = (hasClass(mapWnd, "tripPlay_big-size")) ? getMapSize(config.mapBigDim) : getMapSize(config.mapDim);
            points.forEach(function(point){
                if(point.longitude > maxX) {
                    maxX = point.longitude;
                }
                if(point.longitude < minX) {
                    minX = point.longitude;
                }
                if(point.latitude > maxY) {
                    maxY = point.latitude;
                }
                if(point.latitude < minY) {
                    minY = point.latitude;
                }
            });

            zoomX = parseInt(Math.ceil(Math.log(mapSize.width * 360 / Math.abs(minX - maxX) / 256) / Math.LN2));
            zoomY = parseInt(Math.ceil(Math.log(mapSize.height * 180 / Math.abs(minY - maxY) / 256) / Math.LN2));
            zoom = Math.min(zoomX, zoomY) - 1;
            return {
                center: {
                    lat: minY + Math.abs(maxY - minY) / 2,
                    lng: minX + Math.abs(maxX - minX) / 2
                },
                zoom: Math.min(maxZoom, isNaN(zoom) ? maxZoom : zoom)
            };
        },
        play = function() {
            var stopPlaying = function(){
                    playing = window.clearInterval(playing);
                    applyStyles(controlButtons.play, {display: "inline-block"});
                    applyStyles(controlButtons.pause, {display: "none"});
                };
            /*
            if(checkIsClosePano(lastPano) && !) {
                stop();
            }*/
            applyStyles(controlButtons.play, {display: "none"});
            applyStyles(controlButtons.pause, {display: "inline-block"});
            pause(false);

            playing = window.setInterval(function(){
                if(!playPaused && !playTechPaused) {
                    getNextSVData().then(function(nextSVData){
                        if(!nextSVData || (checkIsClosePano(lastPano) && !checkIsClosePano(firstPano))) {
                            stopPlaying();
                            return false;
                        }
                        showFrame(nextSVData);
                    }).catch(function(error){
                        stopPlaying();
                    });
                }
            }, config.frameDuration);
        },
        showFrame = function(svData, isBack) {
            if(!svData) {
                return processSVData();
            }
            var pano = svData.pano,
                status = svData.status,
                pov = svData.pov,
                panoPosition = panorama.getPosition(),
                panoPoint = (panoPosition) ? {
                    latitude: panoPosition.lat(),
                    longitude: panoPosition.lng()
                } : null,
                nextPoint = getNextLogIndex(points, currPoint, (isBack) ? currPoint - 1 : currPoint + 1, panoPoint);
            if(prevPanos[0] && prevPanos[1] && prevPanos[0].pano === pano && prevPanos[0].isBack === isBack &&
                prevPanos[1].isBack === isBack) {
                getSVData(points, nextPoint, isBack).then(function(svData){
                    currPoint = nextPoint;
                    showFrame(svData, isBack);
                });
                return processSVData();
            }

            prevPanos[0] = prevPanos[1];
            prevPanos[1] = {
                pano: pano,
                isBack: isBack
            };
            return processSVData(pano, status, pov, true);
        },
        pause = function(state) {
            playTechPaused = playPaused = (typeof state === "boolean") ? state : !playPaused;
            controlButtons.pause.innerText = (playPaused) ? "Play" : "Pause";
        },
        stop = function() {
            currPoint = 0;
            prevPanos = [];
            applyStyles(controlButtons.play, {display: "inline-block"});
            applyStyles(controlButtons.pause, {display: "none"});
            getSVData(points, 0, false).then(function(svData) {
                showFrame(svData);
            });
            /*
            getSVData(points, 0, false, function(svData) {
                showFrame(svData);
            });*/
            if(playing) {
                playing = window.clearInterval(playing);
            }
        },
        fw = function() {
            if(!checkIsClosePano(lastPano)) {
                pause(true);
                getNextSVData().then(showFrame).catch();
            }
        },
        rw = function() {
            if(!checkIsClosePano(firstPano)) {
                pause(true);
                getNextSVData(true).then(function(svData){
                    showFrame(svData, true);
                }).catch();
            }
        },
        processSVData = function(pano, status, pov, visible) {
            return new Promise(function(resolve, reject){
                if(!pano) {
                    return resolve();
                }
                var prevPauseState = playTechPaused;
                loadPanoCallback = function(loadedPano){
                    if(pano === loadedPano) {
                        playTechPaused = prevPauseState;
                        resolve();
                        loadPanoCallback = null;
                    }
                };
                loadPanoId = pano;
                if (status === google.maps.StreetViewStatus.OK) {
                    if(!pov) {
                        pov = panorama.getPhotographerPov();
                    }
                    playTechPaused = true;
                    loadPanoramaImages(pano, pov).then(function() {
                        if(pano === panorama.getPano()) {
                            playTechPaused = prevPauseState;
                            loadPanoCallback = null;
                            return resolve();
                        }
                        panorama.setOptions({
                            pano: pano,
                            pov: pov,
                            visible: visible
                        });
                    });
                } else {
                    console.error("Street View data not found for this location.");
                    return reject();
                }
            });
        },
        calculateDirection = function(logs, logIndex, panoPoint, isBack) {
            var log = panoPoint || logs[logIndex],
                nextLogIndex = getNextLogIndex(
                    logs,
                    logIndex,
                    ((logs[logIndex + 1] && !isBack) || (!logs[logIndex - 1] && isBack)) ? logIndex + 1 : logIndex - 1,
                    panoPoint),
                nextLog = logs[nextLogIndex],
                x1 = log.longitude,
                y1 = log.latitude,
                x2 = nextLog.longitude,
                y2 = nextLog.latitude,
                fromPoint = new google.maps.LatLng(
                    ((nextLogIndex > logIndex && !isBack) || (nextLogIndex < logIndex && isBack)) ? y1 : y2,
                    ((nextLogIndex > logIndex && !isBack) || (nextLogIndex < logIndex && isBack)) ? x1 : x2
                ),
                toPoint = new google.maps.LatLng(
                    ((nextLogIndex > logIndex && !isBack) || (nextLogIndex < logIndex && isBack)) ? y2 : y1,
                    ((nextLogIndex > logIndex && !isBack) || (nextLogIndex < logIndex && isBack)) ? x2 : x1
                ),
                angle;

            angle = google.maps.geometry.spherical.computeHeading(fromPoint, toPoint);
            if(angle < 0) {
                angle = 360 + angle;
            }
            return angle;
        },
        getOppositDirection = function(direction) {
            return (direction <= 180) ? direction + 180 : direction - 180;
        },
        getNextLogIndex = function(logs, logIndex, nextLogIndex, panoPoint) {
            if(!logs[nextLogIndex]) {
                return logIndex;
            }
            var sign = nextLogIndex > logIndex,
                log = panoPoint || logs[logIndex],
                x1 = log.longitude,
                y1 = log.latitude,
                x2 = logs[nextLogIndex].longitude,
                y2 = logs[nextLogIndex].latitude,
                deltaX = (nextLogIndex > logIndex) ? x2 - x1 : x1 - x2,
                deltaY = (nextLogIndex > logIndex) ? y2 - y1 : y1 - y2,
                newNextLogIndex;
            if(Math.abs(deltaX) < config.pathInterval && Math.abs(deltaY) < config.pathInterval) {
                currPoint = nextLogIndex;
                newNextLogIndex = (sign) ? nextLogIndex + 1 : nextLogIndex - 1;
                if(!logs[newNextLogIndex]) {
                    return nextLogIndex;
                }
                nextLogIndex = getNextLogIndex(logs, logIndex, newNextLogIndex, panoPoint);
            }
            return nextLogIndex;
        },
        checkIsClosePano = function(targetPano){
            var panoPoint = panorama.getPosition(),
                targetPanoPoint = targetPano.position;
            return (google.maps.geometry.spherical.computeDistanceBetween(panoPoint, targetPanoPoint) < 10);
        },
        loadPanoramaImages = function (panoId, pov) {
            var getSuitableImages = function(w, h, pov) {
                var panoZoom = panorama.getZoom(),
                    wTileDegrees = 360 / w,
                    hTileDegrees = 180 / h,
                    fov = 90,
                    i, j,
                    wHeading1 = pov.heading - fov / 2 - 180,
                    wHeading2 = pov.heading + fov / 2 - 180,
                    tilesFrom, tilesTo,
                    wtiles = [],
                    addTiles = function(from, to) {
                        var i;
                        for(i = from ; i <= to; i++) {
                            if(wtiles.indexOf(i) === -1) {
                                wtiles.push(i);
                            }
                        }
                    };

                if(wHeading1 < 0) {
                    wHeading1 = 360 - wHeading1;
                } else if(wHeading1 > 180) {
                    wHeading1 = wHeading1 - 180;
                }
                if(wHeading2 < 0) {
                    wHeading2 = 360 - wHeading2;
                } else if(wHeading2 > 180) {
                    wHeading2 = wHeading2 - 180;
                }

                if(wHeading1 < wHeading2){
                    tilesFrom = Math.abs(Math.floor(wHeading1 / wTileDegrees));
                    tilesTo = Math.abs(Math.ceil(wHeading2 / wTileDegrees));
                    addTiles(tilesFrom, tilesTo);
                } else {
                    tilesFrom = Math.abs(Math.floor(wHeading1 / wTileDegrees));
                    tilesTo = w - 1;
                    addTiles(tilesFrom, tilesTo);
                    tilesFrom = 0;
                    tilesTo = Math.abs(Math.ceil(wHeading2 / wTileDegrees));
                    addTiles(tilesFrom, tilesTo);
                }

                return wtiles;
            };

            return new Promise(function(resolve){
                if(!config.preloadImages) {
                    return resolve();
                }

                var zoom = config.zoom,
                    w = (zoom === 3) ? 7 : Math.pow(2, zoom),
                    h = Math.pow(2, zoom - 1),
                    url,
                    subdomain,
                    x,
                    y,
                    loadEventListener,
                    errorEventListener,
                    loadedImages = 0,
                    //suitableImages = getSuitableImages(w, h, pov),
                    onImageLoaded = function(){
                        loadedImages ++;
                        //if (loadedImages === suitableImages.length * h) {
                        if (loadedImages === w * h) {
                            resolve();
                        }
                    };

                for (y = 0; y < h; y++) {
                    for (x = 0; x < w; x++) {
                        //if(suitableImages.indexOf(x) > -1) {
                        subdomain = (x % 2) ? "cbks1" : "cbks0";
                        url = "https://" + subdomain + ".googleapis.com/cbk?output=tile&cb_client=apiv3&v=4&gl=US&zoom=" + zoom + "&x=" + x + "&y=" + y + "&panoid=" + panoId + "&fover=2&onerr=3";
                        var img = new Image();
                        loadEventListener = img.addEventListener("load", onImageLoaded);
                        errorEventListener = img.addEventListener("error", onImageLoaded);
                        img.crossOrigin = '';
                        img.src = url;
                        //}
                    }
                }
            });
        },
        unload = function() {
            waiting.stop();
            currPoint = 0;
            prevPanos = [];
            loadPanoCallback = null;

            if(panoCont) {
                panoCont.textContent = "";
            }

            toggleControls(false);

            if(panorama) {
                google.maps.event.clearListeners(panorama, "status_changed");
                panorama.setVisible(false);
                panorama = null;
            }
            if(playing) {
                playing = window.clearInterval(playing);
            }
            if(startMarker) {
                startMarker.setMap(null);
                startMarker = null;
            }
            if(finishMarker) {
                finishMarker.setMap(null);
                finishMarker = null;
            }
            if(povMarker) {
                google.maps.event.clearListeners(povMarker, "drag");
                google.maps.event.clearListeners(povMarker, "dragend");
                povMarker.setMap(null);
                povMarker = null;
            }
            if(tripPath) {
                tripPath.setMap(null);
                tripPath = null;
            }
            if(map) {
                map.setStreetView(null);
            }
            window.removeEventListener("resize", setPanoSize, false);
            window.removeEventListener("resize", resizeMap, false);
            if(controlButtons) {
                controlButtons.play.removeEventListener("click", play, false);
                controlButtons.pause.removeEventListener("click", pause, false);
                controlButtons.stop.removeEventListener("click", stop, false);
                controlButtons.forward.removeEventListener("click", fw, false);
                controlButtons.back.removeEventListener("click", rw, false);
            }
            document.removeEventListener("keyup", processPlayerKey, false);
        };
    return {
        initSV: initSV,
        init: init,
        play: play,
        pause: pause,
        stop: stop,
        unload: unload
    };
})();