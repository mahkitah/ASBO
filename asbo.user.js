// ==UserScript==
// @name         ASBO
// @version      2025-02-17
// @description  Album Side Bar Organiser
// @author       You
// @match        https://orpheus.network/torrents.php?id=*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        GM_deleteValue
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

    const customOrder = GM_getValue('order');
    const lateBoxPromises = [];

    for (const [title, [selector, builtIn, optional]] of Object.entries(boxInfo)) {
        const boxElement = sb.querySelector(selector);
        if (!boxElement) {
            if (!builtIn) {
                lateBoxPromises.push(
                    waitForElement(selector)
                        .then( box => handleLatelBox(box, title))
                        .catch( () => {
                            console.info(title, 'not installed')
                            GM_deleteValue(title);
                            if (customOrder && customOrder.includes(title)){
                                customOrder.splice(customOrder.indexOf(title), 1);
                                GM_setValue('order', customOrder)
                            };
                        })
                    );
                continue
            }
            else if (optional) {
                continue;
            }
        }
        handleBox(boxElement, title)
    };

    const naturalOrderTitles = [...sb.children].map( c => c.boxTitle)

    if (customOrder) {
        naturalOrderTitles.forEach((title, i) => {
            // insert new box title in settingsarray after the title it followed in the (unmanipulated) sidebar
            if (!customOrder.includes(title)) {
                insertAfter(customOrder, naturalOrderTitles[i - 1], title);
                GM_setValue('order', customOrder);
            };
        });
        const filtered = customOrder.filter(item => naturalOrderTitles.includes(item));
        if (JSON.stringify(naturalOrderTitles) !== JSON.stringify(filtered))
            applyOrder(customOrder);
    };

    await Promise.allSettled(lateBoxPromises)
    GM_registerMenuCommand('⚙️ Settings', toggleSettings);

    function handleLatelBox(box, title) {
        handleBox(box, title);
        const previous = box.previousElementSibling.boxTitle;
        insertAfter(naturalOrderTitles, previous, title);

        if (customOrder) {
            if (customOrder.includes(title)) {
                let refTitle = title;
                do {
                    refTitle = customOrder[customOrder.indexOf(refTitle) - 1];
                } while (!naturalOrderTitles.includes(refTitle))

                if (refTitle !== previous) {
                    sb.querySelector(boxInfo[refTitle][0]).after(box);
                }
            } else {
                insertAfter(customOrder, previous, title);
                GM_setValue('order', customOrder);
            };
        };
    };

    function handleBox(boxElement, title) {
        if (title === 'Cover') boxElement.querySelector('#covers').append(boxElement.querySelector('#add_cover_div'));
        boxElement.boxTitle = title
        makeCollapsible(boxElement);
        applyStatus(boxElement, GM_getValue(title, 0));
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

    function applyOrder(orderedTitles) {
        const orderedElements = orderedTitles
            .map(title => sb.querySelector(boxInfo[title][0]))
            .filter(Boolean)
        sb.append(...orderedElements)
    };

    function makeCollapsible(box) {
        const header = box.querySelector('.head');
        const body = header.nextElementSibling;
        body.classList.add('box-body');
        header.querySelector('strong').addEventListener('click', () => body.classList.toggle('box-hidden'))
    };

    function insertAfter(array, after, item) {
        const index = array.indexOf(after);
        array.splice(index + 1, 0, item);
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
                    className: 'just-centered',
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

    function getConfigStyle() {
        const columnCount = 4;
        const padding = 5;
        const border = 2;
        return `
            #asbo-config {
                position: fixed !important;
                top: 100px !important;
                right: 40px !important;
                height: unset !important;
                border: 2px solid !important;
                z-index: 999999 !important;
            }
            #asbo-settings-content {
                display: flex;
                flex-direction: column;
            }
            #asbo-grid {
                padding: ${padding * 2}px;
                display: grid;
                grid-template-columns: max-content repeat(${columnCount - 1}, auto);
                gap: 0 10px;
                align-items: center;
            }
            .full-row {
                grid-column: 1 / span ${columnCount};
            }
            #asbo-bottom-buttons {
                display: flex;
                gap: ${padding}px;
                justify-content: flex-end;
            }
            #asbo-bottom-buttons > :nth-child(2) {
                margin-left: auto;
            }
            .not-present {
                color: color-mix(in srgb, currentColor 70%, transparent);
            }
            .external-box {
                text-decoration: underline dotted;
            }
            .drag-row {
                display: contents;
            }
            .drag-row.dragging .drag-handle {
                opacity: 0.3;
            }
            .drag-row.upping .drag-handle {
                border-top: ${border}px solid;
                padding-top: ${padding - border}px;
            }
            .drag-row.downing .drag-handle {
                border-bottom: ${border}px solid;
                padding-bottom: ${padding - border}px;
            }
            .drag-handle {
                cursor: grab;
                // user-select: none;
            }
            .drag-handle:active {
                cursor: grabbing;
            }
            .column-header {
                margin-bottom: 10px;
           }
            .asbo-pad {
                padding: ${padding}px;
            }
            .just-centered {
                justify-self: center;
            }
        `
    }

    let panel = null;
    let applyBtn;
    const buttonGroups = [];
    let draggedRow;
    let allDragRows;
    let oriGridOrder;
    let gridOrderChanged = false;

    function createConfigPanel() {
        GM_addStyle(getConfigStyle())
        panel = Object.assign(document.createElement('div'), {
            id: 'asbo-config',
            className: 'sidebar',
            innerHTML: `
                <div class="box gm-no-margin asbo-pad" id="asbo-settings-content">
                    <div class="head" id="ss-settings-title">
                        <strong>ASBO Config</strong>
                    </div>
                    <div id="asbo-grid">
                        <strong class="column-header">Sidebar Box</strong>
                        <div class="column-header just-centered">Full</div>
                        <div class="column-header just-centered">Collapsed</div>
                        <div class="column-header just-centered">Hide</div>
                    </div>
                    <div id="asbo-bottom-buttons">
                        <button id="resetBtn">Reset</button>
                        <button id="saveBtn">Apply</button>
                        <button id="closeBtn">Close</button>
                    </div>
                </div>
            `,
        });

        const grid = panel.querySelector('#asbo-grid');

        // Don't set content.innerHTML in or after loop
        // It will remove the event listeners from the radio buttons
        for (const boxName of customOrder || naturalOrderTitles) {
            const [selector, builtIn, optional] = boxInfo[boxName];

            const present = naturalOrderTitles.includes(boxName);
            const status = GM_getValue(boxName, 0);
            const bGroup = new BoxButtonGroup(boxName, selector, status);
            buttonGroups.push(bGroup);

            let labelText = boxName.replaceAll('_', ' ');
            // if (!builtIn && !present) labelText = `(${labelText})`;

            const specialClasses = [];
            if (!present) specialClasses.push('not-present');
            if (!builtIn) specialClasses.push('external-box');

            const row = Object.assign(document.createElement('div'), {
                className: 'drag-row',
                id: boxName,
            });

            const label = Object.assign(document.createElement('div'), {
                    textContent: labelText,
                    draggable: true,
                    className: ['drag-handle asbo-pad', ...specialClasses].join(' '),
                });

            row.append(label, ...bGroup.buttons);
            grid.append(row)

            label.addEventListener('dragstart', (e) => {
                draggedRow = row;
                row.classList.add('dragging');
            });

            label.addEventListener('dragend', (e) => {
                row.classList.remove('dragging');
                grid.querySelectorAll('.upping, .downing').forEach(r => r.classList.remove('upping', 'downing'));
                draggedRow = null;
            });

            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (row === draggedRow) return;

                row.classList.add(goingUp(row)? 'upping' : 'downing');
            });

            row.addEventListener('dragleave', (e) => {
                row.classList.remove('upping', 'downing');
            });

            row.addEventListener('drop', (e) => {
                e.preventDefault();
                if (row === draggedRow) return;
                row.classList.remove('upping', 'downing');
                const where = goingUp(row)? 'before' : 'after';
                row[where](draggedRow)
            });
        };

        document.body.append(panel);
        applyBtn = panel.querySelector('#saveBtn')
        applyBtn.disabled = true;
        applyBtn.addEventListener('click', applySettings);
        panel.querySelector('#closeBtn').addEventListener('click', toggleSettings);
        panel.querySelector('#resetBtn').addEventListener('click', () => {
            if (!confirm('Remove all stored settings?')) return;
            for (const key of GM_listValues()) GM_deleteValue(key);
            location.reload()
        });

        grid.addEventListener('change', enableApplyButton);

        allDragRows = [...grid.querySelectorAll('.drag-row')];
        oriGridOrder = allDragRows.map( r => r.id);

        const gridOrderObserver = new MutationObserver(() => {
            allDragRows = [...grid.querySelectorAll('.drag-row')];
            gridOrderChanged = !oriGridOrder.every((id, i) => id === allDragRows[i].id)
            enableApplyButton();
        });
        gridOrderObserver.observe(grid, {childList: true})

    };

    function goingUp(targetRow) {
        const draggedIndex = allDragRows.indexOf(draggedRow);
        const targetIndex = allDragRows.indexOf(targetRow);
        return draggedIndex > targetIndex;
    };

    function enableApplyButton() {
        applyBtn.disabled = !gridOrderChanged && unsavedChanges().next().done;
    };

    function* unsavedChanges() {
        for (const bGroup of buttonGroups) {
            const storedValue = GM_getValue(bGroup.boxName, 0);
            if (bGroup.selected !== storedValue) {
                yield [bGroup, storedValue];
            };
        };
    };

    function applySettings(e) {
        for (const [bGroup, _] of unsavedChanges()) {
            const box = sb.querySelector(bGroup.selector);
            if (box) applyStatus(box, bGroup.selected);
            GM_setValue(bGroup.boxName, bGroup.selected)
        };
        if (gridOrderChanged) {
            const orderedTitles = allDragRows.map( r => r.id);
            applyOrder(orderedTitles);
            GM_setValue('order', orderedTitles);
            oriGridOrder = orderedTitles;
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