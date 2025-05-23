// ==UserScript==
// @name        JobNimbus Streetview Integration
// @match       *://webappui.jobnimbus.com/*
// @grant       GM_xmlhttpRequest
// @version     1.0 build 2505231032
// @author      Insurance Solutions Services Inc.
// @description Adds a Google Streetview image in place of the contact image in JobNimbus contact pages.
// @downloadURL https://raw.githubusercontent.com/issroofing/userscripts/main/jobnimbus-streetview-integration.user.js
// @updateURL   https://raw.githubusercontent.com/issroofing/userscripts/main/jobnimbus-streetview-integration.user.js
// ==/UserScript==

function getCookieValue(name) {
    let matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
    ));
    return matches ? decodeURIComponent(matches[1]) : undefined;
}

let lastUrl = window.location.href;

// MutationObserver to detect URL changes
const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log("URL changed to: ", lastUrl);

        const currentUrl = window.location.href;
        const contactId = currentUrl.split('/').pop();

        // Construct the URL with the extracted segment
        const apiUrl = `https://app.jobnimbus.com/api2/getcontact?id=${contactId}&jobid=0&duplicate_from_id=undefined&_=${Date.now()}`;

        console.log(apiUrl);

        // Retrieve the necessary cookie values
        const authToken = getCookieValue('JNAuth');
        const messagesUtk = getCookieValue('messagesUtk');
        const refreshToken = getCookieValue('refreshToken');

        // Retrieve the Bearer token from local storage
        const bearerToken = localStorage.getItem('jn.auth.legacyAccessToken');

        if (!bearerToken) {
            console.error('Bearer token not found in local storage');
            return;
        }

        GM_xmlhttpRequest({
            method: "GET",
            url: apiUrl,
            headers: {
                "Authorization": `Bearer ${bearerToken}`,
                "Cookie": `JNAuth=${authToken}; messagesUtk=${messagesUtk}; refreshToken=${refreshToken}`
            },
            onload: function(response) {
                console.log("Response status: ", response.status);
                console.log("Response text: ", response.responseText);

                if (response.status !== 200) {
                    console.error('Network response was not ok');
                    return;
                }

                const data = JSON.parse(response.responseText);
                const contact = data[0];
                const addressURLcomponent = encodeURIComponent(contact.AddressLine1 + ",+" + contact.City + ",+" + contact.StateText + "+" + contact.Zip);
                const GMAPS_PRIVATE_KEY = "AIzaSyBP1a0tgc3DPtAtlasSPtRyZdeGAuzMjv8"
                const satelliteImg = "https://maps.googleapis.com/maps/api/staticmap?center=" + addressURLcomponent + "&zoom=20&size=400x400&maptype=satellite&key=" + GMAPS_PRIVATE_KEY;
                const streetviewImg = "https://maps.googleapis.com/maps/api/streetview?size=400x400&location=" + addressURLcomponent + "&fov=60&key=" + GMAPS_PRIVATE_KEY;
                console.log("Updated contact data: ", contact);
                console.log("Generated satellite image URL: ", satelliteImg);

                // Create and append a new style tag if not present
                const styleTag = document.createElement('style');
                styleTag.setAttribute('data-jobnimbus-style', 'true');
                styleTag.innerHTML = `
                  #PanelAddContact1 div div div.left img {
                    content: url(${streetviewImg}) !important;
                    height: 200px !important;
                    width: 200px !important;
                    object-fit: cover !important;
                    margin-bottom: 10px !important;
                    border: 1px solid #ccc !important;
                  }

                  #PanelAddContact1 div div div.left img:hover {
                    content: url(${satelliteImg}) !important;
                  }

                  #PanelAddContact1 .width100 {
                    padding-top: 6px !important;
                  }
                `;

                document.head.appendChild(styleTag);
                console.log("Style tag injected successfully with new satellite image URL.");
            },
            onerror: function(error) {
                console.error('There was a problem with the XMLHttpRequest operation:', error);
            }
        });
    }
});

// Start observing the document for URL changes
observer.observe(document, { subtree: true, childList: true });
