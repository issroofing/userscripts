// ==UserScript==
// @name        JobNimbus RoofR Integration
// @match       *://webappui.jobnimbus.com/*
// @grant       GM_xmlhttpRequest
// @version     1.0.1
// @author      Insurance Solutions Services Inc.
// @description Adds a button to JobNimbus contact's financials tab to upload a RoofR report and sync measurements tokens automatically.
// @downloadURL https://raw.githubusercontent.com/issroofing/userscripts/main/jobnimbus-roofr-integration.user.js
// @updateURL   https://raw.githubusercontent.com/issroofing/userscripts/main/jobnimbus-roofr-integration.user.js
// ==/UserScript==

// Version 1.0.1 - Released June 5th, 2025 1:26 AM
// Changelog:
// 1. Fixes a bug where the user could not click the checkbox to select/unselect a structure from the list of those identified in the RoofR PDF, forcing the user to instead click the structure thumbnail instead. Users can now click the checkbox itself if they desire.  
// 2. All structures are now unselected by default. The user must click to select the structure(s) they want before continuing. 
// 3. Adds a blue border around selected structures to further clarify which structures are selected. 
// 4. Adds a close button (X) in the top left corner of the Upload RoofR window (users can still click anywhere outside the window to close it). 

function getCookieValue(name) {
    let matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
    ));
    return matches ? decodeURIComponent(matches[1]) : undefined;
}

// Retry mechanism to ensure buttonContainer exists
function waitForElement(selector, callback, interval = 100, maxRetries = 50) {
    let retries = 0;
    const intervalId = setInterval(() => {
        const element = document.querySelector(selector);
        if (element) {
            clearInterval(intervalId);
            callback(element);
        } else if (retries++ >= maxRetries) {
            clearInterval(intervalId);
            console.error(`Element "${selector}" not found after ${maxRetries} retries`);
        }
    }, interval);
}

let lastUrl = window.location.href;

const formData = new FormData();
var include = [];

async function countStructures(previewContainer) {
    const file = formData.get('file'); // Get the file from FormData

    if (!file) {
        console.error('No file found in formData');
        return;
    }

    // Read the file as base64
    const reader = new FileReader();
    reader.onload = function () {
        previewContainer.innerHTML = `
        <span style="margin:20px;">Loading...</span>
        `;
        const base64File = reader.result.split(',')[1]; // Get the base64 part

        // Construct JSON payload
        const payload = {
            b64pdf: base64File,
        };

        console.log('Sending payload:', payload);

        // Send the request
        GM_xmlhttpRequest({
            method: 'POST',
            url: "https://crm-issroofing.pythonanywhere.com/roofr/get-structures",
            data: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json',
            },
            onload: function (response) {
                console.log('Success:', response.responseText);
                updateSubmitButton();
                // Clear the preview container
                previewContainer.innerHTML = '';
                // get the value of the "structures" key from the response
                const structures = JSON.parse(response.responseText).structures;
                console.log('Structures:', structures);
                // For each item in the structures array, log the value for the "summary-index" key
                structures.forEach(structure => {
                    console.log('Summary Index:', structure['summary-index']);
                    console.log('Page number:', structure['page-number']);
                    const summaryIndex = structure['summary-index'];
                    const pageNumber = structure['page-number'];
                    const previewBase64 = structure['thumbnail'];

                    previewContainer.innerHTML = previewContainer.innerHTML + `
<div class="preview">
    <span>Structure #${summaryIndex}</span>
    <img src="data:image/png;base64,${previewBase64}" alt="Structure ${summaryIndex} on page ${pageNumber}">
    <span>Page ${pageNumber}</span>
    <input type="checkbox" name="include" unchecked data-summary-index="${summaryIndex}">
</div>
                    `;

                });

                const checkboxes = previewContainer.querySelectorAll('input[type="checkbox"][name="include"]');
                checkboxes.forEach((checkbox) => {
                    if (checkbox.checked) {
                        include.push(parseInt(checkbox.dataset.summaryIndex, 10));
                    }

                    checkbox.addEventListener('change', function () {
                        const summaryIndex = parseInt(this.dataset.summaryIndex, 10);
                        if (this.checked) {
                            include.push(summaryIndex);
                        } else {
                            include = include.filter((item) => item !== summaryIndex);
                        }
                        updateSubmitButton();
                        console.log(include);
                    });
                    

                    // Clicking anywhere on the preview will toggle the checkbox
                    const preview = checkbox.parentElement;
                    preview.addEventListener('click', function (e) {
                        // If the user clicked exactly on the <input> itself, do nothing here
                        if (e.target === checkbox) return;

                        // Otherwise, toggle the checkbox manually
                        checkbox.checked = !checkbox.checked;
                        checkbox.dispatchEvent(new Event('change'));
                    });

                    

                });

            },
            onerror: function (err) {
                console.error('Error:', err);
            },
        });
    };

    reader.onerror = function () {
        console.error('Error reading file');
    };

    reader.readAsDataURL(file); // Read the file as a base64 string
}


async function submitRoofr(jnid) {
    const file = formData.get('file'); // Get the file from FormData

    if (!file) {
        console.error('No file found in formData');
        return;
    }

    // Read the file as base64
    const reader = new FileReader();
    reader.onload = function () {
        const base64File = reader.result.split(',')[1]; // Get the base64 part

        // Construct JSON payload
        const payload = {
            b64pdf: base64File,
            include: include,
            jnid: jnid,
        };

        console.log('Sending payload:', payload);

        // Send the request
        GM_xmlhttpRequest({
            method: 'POST',
            url: "https://crm-issroofing.pythonanywhere.com/roofr/upload",
            data: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json',
            },
            onload: function (response) {
                console.log('Success:', response.responseText);
                
                closeModal();
            },
            onerror: function (err) {
                console.error('Error:', err);
            },
        });
    };

    reader.onerror = function () {
        console.error('Error reading file');
    };

    reader.readAsDataURL(file); // Read the file as a base64 string
}

function closeModal() {
    const modal = document.querySelector('.roofrModal');
    modal.remove();

    // Display a banner to indicate success
    const banner = document.createElement('div');
    banner.style = `position: fixed; top: 0; left: 0; width: 100%; background-color: #0F9D58; color: #FFF; padding: 16px; text-align: center; font-weight: bold; z-index: 9999;`;
    banner.innerText = 'RoofR report submitted successfully!';
    document.body.appendChild(banner); 

    // Animate the banner
    banner.animate([
        {top: '-100px'},
        {top: '0'},
        {top: '0'},
        {top: '0'},
        {top: '0'},
        {top: '0'},
        {top: '0'},
        {top: '0'},
        {top: '0'},
        {top: '-100px'},
    ], {
        duration: 3000,
        iterations: 1,
    });
    
    // Remove the banner after 3 seconds
    setTimeout(() => {
        banner.remove();
    }, 3000);
}

function updateSubmitButton() {
    const submitButton = document.querySelector('.submitButton');
    if (include.length > 0){
        submitButton.classList.remove('disabled');
    } else {
        submitButton.classList.add('disabled');
    }
    
}



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
                const addressLine1 = contact.AddressLine1;

                // Wait for the buttonContainer to exist before injecting the button
                waitForElement('#contactMeasurements', (buttonContainer) => {

                    // If any instances of the button already exist, remove them
                    const existingButtons = buttonContainer.querySelectorAll('button');
                    existingButtons.forEach(button => button.remove());

                    // Create and add button
                    const roofrButton = document.createElement('button');
                    roofrButton.style.color = '#FFF';
                    roofrButton.style.background = 'linear-gradient(90deg, rgb(58,97,199), rgb(36,131,203), rgb(14,165,207))';
                    roofrButton.style.backgroundSize = '200%';
                    roofrButton.style.backgroundPosition = 'left';
                    roofrButton.style.transition = 'background-position 0.5s ease';
                    roofrButton.style.border = 'none';
                    roofrButton.style.padding = '10px 16px';
                    roofrButton.style.fontSize = '14px';
                    roofrButton.style.cursor = 'pointer';
                    roofrButton.style.borderRadius = '999px';
                    roofrButton.style.fontWeight = 'bold';
                    roofrButton.style.margin = '6px';
                    roofrButton.innerText = "Upload RoofR";

                    // hover effect
                    roofrButton.addEventListener('mouseover', function() {
                        roofrButton.style.backgroundPosition = 'right';
                    });

                    roofrButton.addEventListener('mouseout', function() {
                        roofrButton.style.backgroundPosition = 'left';
                    });

                    buttonContainer.appendChild(roofrButton);
                    console.log("Upload RoofR button injected successfully");

                    roofrButton.addEventListener("click", function() {
                        // Open modal to upload RoofR report
                        const modal = document.createElement('div');
                        modal.className = 'roofrModal';
                        modal.style = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999;';

                        modal.innerHTML = `
                            <style>
                                .uploadForm{
                                    background: #FFF;
                                    padding: 20px;
                                    border-radius: 8px;
                                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                                    width: 400px;
                                    display: flex;
                                    flex-direction: column;
                                    align-items: center;
                                    position: relative;
                                }

                                .uploadLabel{
                                    font-size: 18px;
                                    font-weight: bold;
                                    margin-bottom: 20px;
                                }

                                .fileInput{
                                    margin-bottom: 20px;
                                    margin-top: 0px !important;
                                    height: 16px !important;
                                }

                                .submitButton{
                                    color: #FFF;
                                    background: linear-gradient(90deg, rgb(58,97,199), rgb(36,131,203), rgb(14,165,207));
                                    background-size: 200%;
                                    background-position: left;
                                    transition: background-position 0.5s ease;
                                    border: none;
                                    padding: 10px 16px;
                                    font-size: 14px;
                                    cursor: pointer;
                                    border-radius: 999px;
                                    font-weight: bold;
                                }

                                .submitButton.disabled{
                                    background: #CCC;
                                    cursor: default;
                                }

                                .submitButton:hover{
                                    background-position: right;
                                }

                                .submitButton.disabled:hover{
                                    background-position: left;
                                }

                                .preview img{
                                    width: 120px;
                                    height: auto;
                                    background-color: #FFF;
                                    border-radius: 4px;
                                    margin: 4px;
                                }

                                .preview{
                                    display: flex;
                                    flex-direction: column;
                                    align-items: center;
                                    margin: 16px;
                                    background-color: rgb(230,230,236);
                                    padding: 12px 8px;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    user-select: none;
                                }
                                
                                input[type="checkbox"]{
                                    cursor: pointer;
                                }
                                
                                .preview:has(input[type="checkbox"]:checked) {
                                    box-shadow: 0 0 0 2px rgb(14, 129, 236) inset;
                                }

                                .previewContainer{
                                    width: 100%;
                                    height: auto;
                                    display: flex;
                                    flex-direction: row;
                                    align-items: center;
                                    justify-content: center;
                                    background-color:rgb(244, 244, 248);
                                    border-radius: 8px;
                                    margin-bottom: 20px;
                                }
                                
                                #uploadFormCloseButton{
                                    position: absolute;
                                    left: 6px;
                                    top: 6px;
                                    cursor: pointer;
                                }

                            </style>

                            <form class="uploadForm">
                                <div id="uploadFormCloseButton">
                                    <svg width="18" height="18" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="8" cy="8" r="6" fill="rgb(252,70,69)"/>
                                        <line x1="6" y1="6" x2="10" y2="10" stroke="rgb(137,0,4)" stroke-width="1.5" stroke-linecap="round"/>
                                        <line x1="10" y1="6" x2="6" y2="10" stroke="rgb(137,0,4)" stroke-width="1.5" stroke-linecap="round"/>
                                    </svg>
                                </div>
                                <label class="uploadLabel">Upload RoofR Report</label>
                                <input class="fileInput" type="file" accept=".pdf">
                                <div class="previewContainer"></div>
                                <button class="submitButton disabled">Submit</button>
                            </form>
                        `;

                        // Clicking outside the modal will close it
                        modal.addEventListener('click', function(e) {
                            if (e.target === modal) {
                                modal.remove();
                            }
                        });
                        
                        // Clicking the close button will close the modal
                        const closeButton = modal.querySelector('#uploadFormCloseButton');
                        closeButton.addEventListener('click', function(e) {
                            modal.remove();
                        });

                        const previewContainer = modal.querySelector('.previewContainer');
                        const fileInput = modal.querySelector('.fileInput');
                        const submitButton = modal.querySelector('.submitButton');
                        const formElement = modal.querySelector('.uploadForm');

                        fileInput.addEventListener('change', function () {
                            const file = fileInput.files[0];
                            if (file) {
                                formData.append('file', file);
                                console.log('File added:', file.name);
                                countStructures(previewContainer);
                            }
                        });

                        submitButton.addEventListener('click', function (e) {
                            e.preventDefault(); // Prevent default form submission

                            if (submitButton.classList.contains('disabled')) {
                                return;
                            }
                            submitButton.innerText = 'Submitting...';
                            submitRoofr(contactId);
                            
                        });


                        document.body.appendChild(modal);

                    });
                });
            },
            onerror: function(error) {
                console.error('There was a problem with the XMLHttpRequest operation:', error);
            }
        });
    }
});

// Start observing the document for URL changes
observer.observe(document, { subtree: true, childList: true });
