// ==UserScript==
// @name         ASBO
// @version      2025-02-17
// @description  Album Side Bar Organiser
// @author       You
// @match        https://orpheus.network/torrents.php?id=*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

( async () => {
    'use strict';
    const sb = document.querySelector('.sidebar');
    if (!sb) return;

    const externalScriptsTimeOut = 1000;

    GM_addStyle(`
        .gm-no-margin {
            margin: 0 !important;
        }
        .box-hidden {
            display: none !important;
        }
        .sidebar .box .head strong {
            cursor: pointer;
        }
        .box_albumart .head > span {
            float: unset !important;
            font-size: unset !important;
        }
    `);

    // Title:               [ selector,              built-in, optional ]
    const boxInfo = {
        Cover:              ['.box_albumart',           true,  false],
        Artists:            ['.box_artists',            true,  false],
        Add_Artists:        ['.box_addartists',         true,  false],
        Add_to_collage:     ['.box_addcollage_torrent', true,  false],
        Orpheus_Favorites:  ['#votes_ranks',            true,  true ],
        Statistics:         ['.box-albumstats',         true,  false],
        Album_votes:        ['#votes',                  true,  false],
        Tags:               ['.box_tags',               true,  false],
        Add_tag:            ['.box_addtag',             true,  false],
        YAETS:              ['.yaets',                  false, true ],
        YADG:               ['#yadg_div',               false, true ],
        YAVAH:              ['#YAVAH',                  false, true ],
    };

    const foundBoxes = new Map();
    const externalsPromises = [];

    for (const [title, [selector, builtIn, optional]] of Object.entries(boxInfo)) {
        if (!builtIn) {
            externalsPromises.push(
                waitForElement(selector)
                    .then( (box) => {
                        handleBox(box, title)
                    })
                    .catch( () => {
                        console.info(title, 'not installed');
                    })
                );
            continue
        };
        const boxElement = sb.querySelector(selector);
        if (!boxElement && optional) continue;

        if (title === 'Cover') boxElement.querySelector('#covers').append(boxElement.querySelector('#add_cover_div'));
        handleBox(boxElement, title)
    };

    await Promise.allSettled(externalsPromises);

    const sbChildren = Array.from(sb.children);
    const orderedTitles = Array(foundBoxes.size);

    for (const [title, boxElement] of foundBoxes) {
        const index = sbChildren.indexOf(boxElement);
        orderedTitles[index] = title;
    };
    if (!foundBoxes.has('Orpheus_Favorites')) {
        const statsIndex = orderedTitles.indexOf('Statistics');
        orderedTitles.splice(statsIndex, 0, 'Orpheus_Favorites');
    }
    for (const [title, [selector, builtIn, optional]] of Object.entries(boxInfo)) {
        if (!builtIn && !foundBoxes.has(title)) orderedTitles.push(title);
    };

    function handleBox(boxElement, title) {
        makeCollapsible(boxElement);
        applyStatus(boxElement, GM_getValue(title, 0));
        foundBoxes.set(title, boxElement);
    };

    function applyStatus(box, status) {
        if (status === 2) {
            box.classList.add('box-hidden');
        }
        else {
            box.classList.remove('box-hidden')
            const body = box.querySelector('.box-body')
            if (status === 1) {
                body.classList.add('box-hidden')
            }
            else if (status === 0) {
                body.classList.remove('box-hidden')
            }
        };
    };

    GM_registerMenuCommand('⚙️ Settings', toggleSettings);

    function makeCollapsible(box) {
        const header = box.querySelector('.head');
        const body = header.nextElementSibling;
        body.classList.add('box-body');
        header.querySelector('strong').addEventListener('click', () => body.classList.toggle('box-hidden'))
    };

    function waitForElement(selector) {
        return new Promise((resolve, reject) => {
            const box = sb.querySelector(selector);
            if (box) {
                return resolve(box);
            }
            const observer = new MutationObserver( () => {
                const box = sb.querySelector(selector);
                if (box) {
                    observer.disconnect();
                    resolve(box);
                }
            });
            observer.observe(sb, {childList: true});

            setTimeout(() => {
                observer.disconnect();
                reject(`${selector} timeout`)
            }, externalScriptsTimeOut);

        });
    };

    class BoxButtonGroup {
        constructor(boxName, selector, status) {
            this.boxName = boxName;
            this.selector = selector;
            this.buttons = [];
            this.selected = status;
            for (let i = 0; i < 3; i++)  {
                const btn = Object.assign(document.createElement('input'), {
                    type: 'radio',
                    name: boxName,
                    nr: i,
                    checked: (i === status),
                });

                btn.addEventListener('change', (e) => {
                    this.selected = e.target.nr;
                });
                this.buttons.push(btn);
            };
        };

        setStatus(status) {
            const btn = this.buttons[status]
            if (!btn.checked) {
                this.buttons[status].checked = true;
                btn.dispatchEvent(new Event('change', { bubbles: true }));
            };
        }
    };

    GM_addStyle(`
        #sidebar-shrink-config {
            position: fixed !important;
            top: 50px !important;
            right: 40px !important;
            height: unset !important;
            border: 2px solid !important;
            z-index: 999999 !important;
        }
        #ss-settings-content {
            padding: 10px;
            display: grid;
            grid-template-columns: repeat(4, max-content);
            gap: 10px 1rem;
        }
        #ss-settings-title {
            grid-column: 1 / span 4;
        }
        .divider {
            grid-column: 1 / span 4;
        }
        #ss-settings-buttons {
            grid-column: 1 / span 4;
            text-align: right !important;
            margin-top: 10px;
        }
        .not-present {
            color: color-mix(in srgb, currentColor 70%, transparent);
        }
        .external-box {
            text-decoration: underline dotted;
        }
    `);

    let panel = null;
    let applyBtn;
    const buttonGroups = [];

    function createConfigPanel() {
        panel = Object.assign(document.createElement('div'), {
            id: 'sidebar-shrink-config',
            className: 'sidebar',
        });

        panel.innerHTML = `
            <div class="box gm-no-margin" id="ss-settings-content">
                <div class="head pad" id="ss-settings-title">
                    <strong>ASBO Config</strong>
                </div>
            </div>
        `;

        const content = panel.querySelector('#ss-settings-content');
        content.innerHTML += `
            <strong>Sidebar Box</strong>
            <div>Full</div>
            <div>Collapsed</div>
            <div>Hide</div>
            <div class="divider"></div>
        `;
        let previousCheck = false;
        // Don't set content.innerHTML in or after loop
        // It will remove the event listeners from the radio buttons
        for (const boxName of orderedTitles) {
            const [selector, builtIn, optional] = boxInfo[boxName];

            const present = foundBoxes.has(boxName);
            if (!builtIn && !present && !previousCheck) {
                content.append(Object.assign(document.createElement('div'), {className: 'divider'}))
                previousCheck = true;
            };
            const status = GM_getValue(boxName, 0);
            const bGroup = new BoxButtonGroup(boxName, selector, status);
            buttonGroups.push(bGroup);

            let labelText = boxName.replaceAll('_', ' ');
            if (!builtIn && !present) labelText = `(${labelText})`;

            const specialClasses = [];
            if (!present) specialClasses.push('not-present');
            if (!builtIn) specialClasses.push('external-box');

            content.append(Object.assign(document.createElement('div'), {
                textContent: labelText,
                ...(specialClasses.length && {className: specialClasses.join(' ')}),
            }));

            content.append(...bGroup.buttons);
        };
        content.append(Object.assign(document.createElement('div'), {
            id: 'ss-settings-buttons',
            innerHTML: `
                <button id="saveBtn">Apply</button>
                <button id="closeBtn">Close</button>
            `,
        }));


        document.body.append(panel);
        applyBtn = panel.querySelector('#saveBtn')
        applyBtn.disabled = true;
        applyBtn.addEventListener('click', applySettings);
        panel.querySelector('#closeBtn').addEventListener('click', toggleSettings);

        content.addEventListener('change', () => applyBtn.disabled = unsavedChanges().next().done);
    };

    function* unsavedChanges() {
        for (const bGroup of buttonGroups) {
            const storedValue = GM_getValue(bGroup.boxName, 0);
            if (bGroup.selected !== storedValue) {
                yield [bGroup, storedValue];
            }
        };

    };

    function applySettings(e) {
        for (const [bGroup, _] of unsavedChanges()) {
            const box = sb.querySelector(bGroup.selector);
            if (box) applyStatus(box, bGroup.selected);
            GM_setValue(bGroup.boxName, bGroup.selected)
        };
        e.target.disabled = true;
    };

    async function toggleSettings() {
        if (!panel) {
            createConfigPanel();
            return
        };
        if (panel.classList.contains('gm-hide')) {
            for (const [bGroup, storedValue] of unsavedChanges()) {
                bGroup.setStatus(storedValue);
            };
        } else {
            for (const _ of unsavedChanges()) {
                if (!confirm('Close without applying changes?')) return;
                break;
            };
        }
        panel.classList.toggle('gm-hide');
    };
})();