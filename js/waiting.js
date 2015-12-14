var tripPlayAddin = tripPlayAddin || {};

tripPlayAddin.waiting = function() {
    "use strict";

    var waitingContainer,
        bodyEl = document.body,
        start = function(el) {
            var elPos;
            waitingContainer = document.createElement("div");
            waitingContainer.className = "waiting";
            waitingContainer.innerHTML = "<div class='fader'></div><div class='spinner'></div>";
            bodyEl.appendChild(waitingContainer);

            if(!el) {
                el = bodyEl;
            }
            elPos = el.getBoundingClientRect();
            waitingContainer.style.position = "absolute";
            waitingContainer.style.width = elPos.width + "px";
            waitingContainer.style.height = elPos.height + "px";
            waitingContainer.style.top = elPos.top + "px";
            waitingContainer.style.left = elPos.left + "px";
            waitingContainer.style.display = "block";

        },
        stop = function() {
            if(waitingContainer && waitingContainer.parentNode) {
                waitingContainer.parentNode.removeChild(waitingContainer);
            }
        };

    return {
        start: start,
        stop: stop
    };
};