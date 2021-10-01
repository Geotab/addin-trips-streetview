# Trips Streetview Addin

An addin that allows choosing a trip and then plays that trip back through streetview. Allows the trip to be moved forward or back or paused. 

### Installation
Add the configuation below to the to the system setting -> addins section of the MyGeotab database
```
{
    "supportEmail": "support@example.com",
    "isSigned": false,
    "signature": "12345-MYSIGNATURE",
    "name": "Trips Street View (by Geotab)",
    "items": [
        {
            "icon": "https://cdn.jsdelivr.net/gh/Geotab/addin-trips-streetview/images/icon.svg",
            "path": "ActivityLink/",
            "menuName": {
                "en": "Trips Street View"
            },
            "url": "https://cdn.jsdelivr.net/gh/Geotab/addin-trips-streetview/tripsStreetView.html"
        }
    ],
    "version": "1.0",
    "key": "12345-MYAPIKEY"
}
```
