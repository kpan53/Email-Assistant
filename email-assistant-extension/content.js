console.log("Email Assistant Extension - Content Script Loaded");

function findComposeToolbar() {
    const selectors = [
        '.btC',
        '.aDh',
        '[role="toolbar"]', //Toolbar is where is the blue send button resides when replying/creating an email
        '.gU.Up'
    ];

    for (const selector of selectors) {
        const toolbar = document.querySelector(selector);
        if (toolbar) {
            return toolbar;
        }
        return null;
    }
}

function createAIButton() {
    //This is the exact same way Gmail defines their buttons using Inspect Element
    const button = document.createElement('div');
    button.className = 'T-I J-J5-Ji aoO v7 T-I-atl L3';
    button.style.marginRight = '8px';
    button.innerHTML = 'Assistants Reply';
    button.setAttribute('role', 'button');
    button.setAttribute('data-tooltip', "AI Assistance")
    return button;
}

function getEmailContent(){
    const selectors = [
        '.h7',
        '.a3s.aiL',
        '.gmail_quote',
        '[role="presentation"]'
    ];

    for (const selector of selectors) {
        const content = document.querySelector(selector);
        if (content) {
            return content.innerText.trim();
        }
        return '';
    }
}

function injectButton() {
    const existingButton = document.querySelector('.ai-reply-button');
    if (existingButton) existingButton.remove();

    //Have to check if the tool bar exists to inject the button in the first place
    const toolbar = findComposeToolbar();
    if (!toolbar) {
        console.log("Toolbar not Found!");
        return;
    }

    console.log("Toolbar Found! Creating Assistants Button.");
    const button = createAIButton();
    button.classList.add('ai-reply-button');

    //This is where we send info to the backend once the button we created is clicked on
    button.addEventListener('click', async () => {
        try {
            button.innerHTML = 'Assisting...';
            button.disabled = true;

            const emailContent = getEmailContent();
            const response = await fetch('http://localhost:8080/api/email/generate', { //Query's the API
                method : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ //How we pass the data to the backend
                    emailContent: emailContent,
                    tone: "Proffesional"
                })
            });

            if (!response.ok){
                throw new Error('API Request is Cooked!');
            }
            const generatedReply = await response.text();

            const composeBox = document.querySelector('[role="textbox"][g_editable="true"]');
            if (composeBox) {
                composeBox.focus();
                document.execCommand('insertText', false, generatedReply); //This is a built-in method that mimics user actions like inserting text
            } else {
                console.error('Compose Box not Found!');
            }
        } catch (error) {
            console.error(error);
            alert('Reply Generation Failed!');
        } finally {
            button.innerHTML = 'Assistants Reply';
            button.disabled = false;
        }
    });

    toolbar.insertBefore(button, toolbar.firstChild);

}

const observer = new MutationObserver((mutations) => {
    for(const mutation of mutations) {
        const addedNodes = Array.from(mutation.addedNodes);
        const hasComposeElements = addedNodes.some(node =>
            node.nodeType === Node.ELEMENT_NODE && 
            (node.matches('.aDh, .btC, [role="dialog"]') || node.querySelector('.aDh, .btC, [role="dialog"]')) //These are the classes associated with the toolbar
        );

        if (hasComposeElements) {
            console.log("Compose Window Detected");
            setTimeout(injectButton, 500);
        }
    }
});


observer.observe(document.body, {
    childList: true,
    subtree: true
});