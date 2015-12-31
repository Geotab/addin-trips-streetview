(function(window){
    "use strict";

    function applyProps(el, props) {
        Object.keys(props).forEach(function(propName){
            if(typeof props[propName] === "object" && el[propName]) {
                applyProps(el[propName], props[propName]);
            } else {
                if(propName === "className") {
                    classNameCtrl(el).set(props[propName]);
                } else {
                    el[propName] = props[propName];
                }
            }
        });
    }

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

    function hasParent(el, parent, iterationsLimit, currIteration) {
        var parentClass = (typeof parent === "string") ? parent : null;

        if(!currIteration) {
            currIteration = 0;
        }
        if(!iterationsLimit) {
            iterationsLimit = 0;
        }
        if((iterationsLimit && currIteration === iterationsLimit) || !el || (el === document.body && (el !== parent || !hasClass(el, parentClass)))) {
            return null;
        }
        if(el === parent || hasClass(el, parentClass)) {
            return el;
        } else {
            return hasParent(el.parentNode, parent, iterationsLimit, currIteration++);
        }
    }


    window.ExtSelect = function(container, initSettings) {
        var $select,
            $selectText,
            $selectArrow,
            $popup,
            $filter,
            currFilter,
            $optionsContainer,
            $container,
            $wrapper,
            $options,
            $selectAll,
            optionsData,
            selectedData = {},// stores object of selected items ( format: {id: name})
            uniqueId = "extSelect_" + Math.floor(Math.random() * 10000000),
            optionName = "option_" + Math.floor(Math.random() * 10000000),
            settings = {
                width: 200,
                popupHeight: 300,
                placeholder: "Select Item",
                multiple: true,
                selectAll: true,
                itemsLimit: 0
            },
            fireEvent = function(event, args){
                if (typeof settings[event] === "function") {
                    return settings[event].apply(null, args || []);
                }
                return true;
            },
            clear = function() {
                $optionsContainer.innerHTML = "";
                applyProps($selectText, {
                    innerText: settings.placeholder
                });
                addClass($selectText, "es-selection-text placeholder");
                $options = [];
                //$filter.value = "";
            },
            createItem = function(item){
                if(!item.value || !item.label) {
                    return false;
                }
                // Creating option container
                var $option,
                    additionalClass = (item.value === "es-all") ? " select-all" : "",
                    type = (settings.multiple) ? "checkbox" : "radio",
                    template =
                        '<label class="es-option-label' + additionalClass + '">' +
                            '<input type="' + type + '" class="es-option-control" value="' + item.value + '" name="' + optionName + '">' +
                            '<div class="es-option-label-text">' + item.label + '</div>' +
                        '</label>';

                $option = document.createElement("LI");
                addClass($option, "es-option-item");
                //$optionsContainer.appendChild($option);
                $option.innerHTML = template;

                if(item.selected) {
                    setOptionState($option, true);
                }

                return $option;
            },
            optionClick = function($control){
                var res = $control.checked;
                if(!settings.multiple) {
                    setSelected([]);
                }
                setOptionState($control.parentNode.parentNode, res);

                if($control.value === "es-all") {
                    selectAll(res);
                } else {
                    fireEvent("onClick", [$control.value, res]);
                }

                setSelectionText();
                //fireEvent("onClick", [$control.value, res]);
            },
            setOptionState = function($option, isSelect) {
                if(!$option.childNodes[0] || !$option.childNodes[0].childNodes[0]) {
                    return false;
                }
                var $control = $option.childNodes[0].childNodes[0],
                    id = $control.value,
                    text = $option.childNodes[0].childNodes[1].textContent;
                (isSelect) ? selectedData[id] = text : delete selectedData[id];
                $control.checked = isSelect;
                (isSelect) ? addClass($option, "active") : removeClass($option, "active");
            },
            setItems = function(items){
                var $option,
                    $tempCont = document.createDocumentFragment(),
                    $newOptions = [];
                optionsData = items;
                if(settings.multiple && settings.selectAll && items.length > 0) {
                    $selectAll = createItem({
                        value: "es-all",
                        label: "Select all"
                    });
                    $tempCont.appendChild($selectAll);
                }

                items.some(function(item){
                    var $prevItem = getOptionByValue(item.value);
                    if(!checkFilter(item.label)) {
                        item.selected = false;
                        return false;
                    }
                    if($prevItem) {
                        $option = $prevItem;
                    } else {
                        $option = createItem(item);
                    }
                    $newOptions.push($option);
                    $tempCont.appendChild($option);
                    return (!!settings.itemsLimit && settings.itemsLimit <= $newOptions.length);
                });
                clear();
                $options = $newOptions;
                optionName = "option_" + Math.floor(Math.random() * 10000000);
                $optionsContainer.appendChild($tempCont);
                moveToFirstSelected();
                setSelectionText();
            },
            getOptionByValue = function(value){
                var i,
                    $option;
                for(i = 0; i < $options.length; i++) {
                    $option = $options[i];
                    if($option && $option.childNodes && $option.childNodes[0] && $option.childNodes[0].childNodes[0] && $option.childNodes[0].childNodes[0].value === value) {
                        return $option;
                    }
                }
                return null;
            },
            setSelectionText = function() {
                var text,
                    selectedQty = Object.keys(selectedData).length,
                    fullText = Object.keys(selectedData).map(function(id){
                        return selectedData[id];
                    }).join(", ");

                if($selectAll) {
                    setOptionState($selectAll, selectedQty === $options.length);
                }
                removeClass($selectText, "placeholder");
                if(!selectedQty) {
                    text = settings.placeholder;
                    addClass($selectText, "placeholder");
                } else if(selectedQty < 4) {
                    text = fullText;
                } else {
                    text = selectedQty + " items selected";
                }
                $selectText.textContent = text;
                $select.title = fullText;
            },
            setSettings = function(newSettings){
                var settingName;
                for(settingName in newSettings) {
                    if(newSettings.hasOwnProperty(settingName)){
                        settings[settingName] = newSettings[settingName];
                    }
                }
            },
            open = function() {
                if(hasClass($wrapper, "disabled")) {
                    return false;
                }
                //fireEvent("onBeforeOpen");
                removeClass($popup, "closed");
                addClass($popup, "opened");
                removeClass($selectArrow, "closed");
                addClass($selectArrow, "opened");
                moveToFirstSelected();
                fireEvent("onOpen");
            },
            close = function(isClickedOutside) {
                if(hasClass($popup, "closed")) {
                    return false;
                }
                if(!fireEvent("onBeforeClose", [isClickedOutside])) {
                    return false;
                }
                removeClass($popup, "opened");
                addClass($popup, "closed");
                removeClass($selectArrow, "opened");
                addClass($selectArrow, "closed");
                fireEvent("onClose", [isClickedOutside]);
            },
            moveToFirstSelected = function(){
                var index,
                    $option,
                    itemPosition;
                for(index = 0; index < $options.length; index++) {
                    $option = $options[index];
                    if($option.childNodes[0].childNodes[0].checked) {
                        itemPosition = $option.offsetTop;
                        $optionsContainer.scrollTop = itemPosition - $optionsContainer.offsetTop - 5;
                        return false;
                    }
                }
                $optionsContainer.scrollTop = 0;
            },
            getSelected = function(){
                return Object.keys(selectedData);
            },
            setSelected = function(selected){
                selectedData = Object.keys(selectedData).reduce(function(res, id) {
                    if (selected.indexOf(id) > -1) {
                        res[id] = selectedData[id];
                    }
                    return res;
                }, {});
                $options.forEach(function($option){
                    var $control = $option.childNodes[0].childNodes[0];
                    setOptionState($option, (selected.indexOf($control.value) > -1));
                });
                setSelectionText();
            },
            /*
            getSelectedOptions = function(isFullVersion){
                return $options.reduce(function(values, $option){
                    var $control = $option.childNodes[0].childNodes[0];
                    if($control.checked) {
                        values.push((isFullVersion) ? $option : $control.value);
                    }
                    return values;
                }, []);
            },*/
            selectAll = function(isSelect) {
                $options.forEach(function($option){
                    if($option.style.display !== "none") {
                        setOptionState($option, isSelect);
                    }
                });
                fireEvent("onAllSelect", [isSelect]);
            },
            disable = function(){
                addClass($wrapper, "disabled");
                close();
            },
            enable = function(){
                removeClass($wrapper, "disabled");
            },
            isDisabled = function(){
                return hasClass($wrapper, "disabled");
            },
            getFilter = function(){
                return $filter.value;
            },
            setFilter = function(val){
                var prevValue = getFilter();
                $filter.value = val || "";
                if(prevValue !== val) {
                    filterListener();
                }
            },
            applyFilter = function(text) {
                if(text) {
                    setFilter(text);
                }
                if(optionsData) {
                    setItems(optionsData);
                }
            },
            checkFilter = function(label) {
                return label.toUpperCase().indexOf(getFilter().toUpperCase()) > -1;
            },
            filterListener = function(e){
                if(e) {
                    e.stopPropagation();
                }
                var value = getFilter();
                if(currFilter === value) {
                    return false;
                }
                currFilter = value;
                if(fireEvent("onBeforeFilter", [value])) {
                    applyFilter(value);
                    fireEvent("onFilter", [getSelected()]);
                }
            },
            selectClickListener = function(e){
                if(hasClass($wrapper, "disabled")) {
                    return false;
                }
                var $controlClicked = hasClass(e.target, "es-option-control") ? e.target : null;
                if(hasParent(e.target, $wrapper, 5)) {
                    if (hasParent(e.target, $select, 5)) {
                        if (hasClass($popup, "opened")) {
                            close();
                            return false;
                        }
                        open();
                    } else if ($controlClicked) {
                        optionClick($controlClicked);
                    }
                } else if(hasClass($popup, "opened")){
                    close(true);
                }
            },
            attachListeners = function(){
                $filter.addEventListener("keyup", filterListener, false);
                document.body.addEventListener("click", selectClickListener, false);
            },
            setInitSelectedData = function(data){
                selectedData = data;
            },
            init = function(container){
                if(!container) {
                    return false;
                }

                var template =
                    '<div class="es-selection-container">' +
                        '<div class="es-selection-text placeholder">' + settings.placeholder + '</div>' +
                        '<div class="es-selection-arrow closed"></div>' +
                    '</div>' +
                    '<div class="es-popup closed" style="position: absolute;">' +
                        '<div class="es-filter-container"><input type="text" class="es-filter" /></div>' +
                        '<ul class="es-options-container"></ul>' +
                    '</div>';

                $container = container;
                setSettings(initSettings);

                $wrapper = document.createElement("DIV");
                applyProps($wrapper, {
                    style: {
                        width: settings.width + "px",
                        position: "relative"
                    },
                    id: uniqueId,
                    className: "extSelect"
                });
                $container.appendChild($wrapper);

                $wrapper.innerHTML = template;

                // creating top element
                $select = document.querySelector("#" + uniqueId + " .es-selection-container");

                // creating selection text element
                $selectText = document.querySelector("#" + uniqueId + " .es-selection-text");

                // creating selection text element
                $selectArrow = document.querySelector("#" + uniqueId + " .es-selection-arrow");

                // creating popup element
                $popup = document.querySelector("#" + uniqueId + " .es-popup");
                applyProps($popup, {
                    style: {
                        width: settings.width + "px"
                    }
                });

                // creating filter element
                $filter = document.querySelector("#" + uniqueId + " .es-filter");

                // creating options container element
                $optionsContainer = document.querySelector("#" + uniqueId + " .es-options-container");
                applyProps($optionsContainer, {
                    style: {
                        maxHeight: settings.popupHeight + "px"
                    }
                });

                clear();

                // Attaching Events Listeners
                attachListeners();
            },
            getOptionsCount = function(){
                return $options.length || 0;
            },
            unload = function(){
                $filter.removeEventListener("keyup", filterListener, false);
                document.body.removeEventListener("click", selectClickListener, false);
                $container.removeChild($wrapper);
            };

        init(container, initSettings);

        return {
            setItems: setItems,
            getSelected: getSelected,
            setSelected: setSelected,
            getFilter: getFilter,
            setFilter: setFilter,
            setSelectionText: setSelectionText,
            setInitSelectedData: setInitSelectedData,
            isDisabled: isDisabled,
            disable: disable,
            enable: enable,
            open: open,
            close: close,
            unload: unload,
            getOptionsCount: getOptionsCount
        };
    };

})(window);
