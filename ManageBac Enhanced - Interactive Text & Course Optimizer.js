// ==UserScript==
// @name         ManageBac Enhanced - Interactive Text & Course Optimizer
// @namespace    http://tampermonkey.net/
// @version      2025-09-11
// @description  Dynamic text, smart course names, blur unlocks, full SPA
// @author       Arstoien
// @match        https://kueishan.managebac.com/*
// @match        https://*.managebac.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=managebac.com
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // === 替換指定課程名稱 ===
    function replaceMenuTitles() {
        const replacements = [
            [
                '[Home]  Enrichment: MYP Math (Grade 9) Summer',
                'Math (Summer)'
            ],
            [
                'IB MYP Foundations: Language and Literature: English (Grade 10) A',
                'English LL'
            ],
            [
                'IB MYP Language and Literature: Chinese  (Grade 10) A',
                'Chinese LL'
            ],
            [
                '[Home]  Enrichment: MYP Chinese (Grade 9) Summer',
                'Chi (Summer)'
            ],
            [
                '[Home]  Enrichment: MYP English (Grade 9) Summer',
                'Eng (Summer)'
            ],
            [
                'G10 IB MYP Language Acquisition: English Phases 1, 2, 3, 4, 5, 6 (Grade 10)',
                'English LA'
            ],
            [
                'IB MYP Individuals & Societies: Modern World History (Grade 10) A',
                'I&S'
            ],
            [
                'IB MYP Sciences: Biology (Grade 10) A',
                'Biology'
            ],
            [
                'IB MYP Mathematics: Standard (Grade 10) A',
                'Math'
            ],
            [
                'IB MYP Arts: Visual Arts (Grade 10) A',
                'Visual Arts'
            ],
            [
                'IB MYP Physical and Health Education (Grade 10) A',
                'PE'
            ],
            [
                'IB MYP Personal Project (Grade 10) 1',
                'Personal Project'
            ],
            [
                'G10 Bible (Grade 10) A',
                'Bible'
            ],
            [
                'G10 Guidance  (Grade 10) A',
                'Guidance'
            ],
            [
                'HS National Military Defense Education 全民國防教育  (Grade 10) AB',
                'Military Defense'
            ],
            [
                'Extended Reading (Grade 10) A',
                'Extended Reading'
            ]
        ];
        document.querySelectorAll('span.f-menu__submenu-link-title').forEach(span => {
            for (const [from, to] of replacements) {
                if (span.textContent.trim() === from) {
                    span.textContent = to;
                }
            }
        });
    }

    // === 核心功能：給 h1 加入游標放大效果 ===
    function enhanceHeader() {
        document.querySelectorAll('h1:not(.f-animated)').forEach(h1 => {
            h1.classList.add('f-animated');
            const text = h1.textContent;
            h1.innerHTML = '';

            // 為每個字符創建 span 元素
            for (let i = 0; i < text.length; i++) {
                const span = document.createElement('span');
                span.textContent = text[i] === ' ' ? '\u00A0' : text[i];
                span.className = 'f-anim-char';
                h1.appendChild(span);
            }

            // 添加鼠標移動事件
            h1.addEventListener('mousemove', handleMouseMove);
            h1.addEventListener('mouseleave', handleMouseLeave);
        });
    }

    // 處理鼠標移動事件
    function handleMouseMove(e) {
        if (!e.target.classList.contains('f-anim-char')) return;

        const h1 = e.currentTarget;
        const chars = Array.from(h1.querySelectorAll('.f-anim-char'));
        const idx = chars.indexOf(e.target);

        chars.forEach((span, i) => {
            span.classList.remove('f-anim-hover', 'f-anim-shrink-1', 'f-anim-shrink-2', 'f-anim-shrink-3');
            const dist = Math.abs(i - idx);
            if (i === idx) {
                span.classList.add('f-anim-hover');
            } else if (dist <= 3) {
                span.classList.add('f-anim-shrink-' + dist);
            }
        });
    }

    // 處理鼠標離開事件
    function handleMouseLeave(e) {
        const h1 = e.currentTarget;
        h1.querySelectorAll('.f-anim-char').forEach(span => {
            span.classList.remove('f-anim-hover', 'f-anim-shrink-1', 'f-anim-shrink-2', 'f-anim-shrink-3');
        });
    }

    // === 初始化 ===
    function init() {
        enhanceHeader();
        replaceMenuTitles();
        addLightWaveToCards();
        initSidebarAnimation();
        replaceTimetableWithIframe();
        initLabelFlip(); // label flip
        initCardSequentialFlip(); // card sequential flip
    }
    init();



    // === 監聽 SPA 換頁與 DOM 變動 ===
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            init();
        }
        replaceMenuTitles();
        enhanceHeader();
        replaceTimetableWithIframe();
        initLabelFlip(); // label flip
        initCardSequentialFlip(); // card sequential flip
    }).observe(document, { subtree: true, childList: true });

    // === 定時強制檢查 h1 是否有 interactive text ===

    setInterval(() => {
        enhanceHeader();
        replaceTimetableWithIframe();
    }, 500);

    // === 每次頁面獲得焦點時強制 enhanceHeader ===
    window.addEventListener('focus', enhanceHeader);



    // === 添加光波動畫到作業卡片 ===
    function addLightWaveToCards() {
        document.querySelectorAll('.fusion-card-item.short-assignment:not(.wave-added)').forEach(card => {
            card.classList.add('wave-added');
            const lightWave = document.createElement('div');
            lightWave.className = 'light-wave';
            card.appendChild(lightWave);
        });
    }

    // === 側邊欄動畫控制 ===
    function initSidebarAnimation() {
        const menuTrigger = document.getElementById('menu-trigger');
        const menu = document.querySelector('.f-menu');

        if (menuTrigger && menu) {
            menuTrigger.addEventListener('click', () => {
                if (menu.classList.contains('f-menu--expanded')) {
                    menu.classList.add('menu-animating');
                    setTimeout(() => {
                        menu.classList.remove('menu-animating');
                    }, 600);
                }
            });
        }
    }


    // === 偵測並取代課表 ===
    function replaceTimetableWithIframe() {
        // 找到所有 timetable-wrapper 並全部移除，只插入一個 iframe
        const timetables = document.querySelectorAll('.timetable-wrapper');
        let mainContent = null;
        timetables.forEach(timetable => {
            if (!mainContent) mainContent = timetable.closest('.f-layout-main__content');
            timetable.remove();
        });
        if (mainContent) {
            // 檢查是否已經有 prime timetable iframe，避免重複插入
            if (!mainContent.querySelector('iframe[src*="primetimetable.com"]')) {
                const iframe = document.createElement('iframe');
                iframe.src = 'https://primetimetable.com/publish/?id=4af61a36-189f-467b-82e8-f92f32927b75&time=6#id=4af61a36-189f-467b-82e8-f92f32927b75&view=1&classId=358e7c4a-7d4a-41b2-aedd-eac162707cc9';
                iframe.style.width = '100%';
                iframe.style.height = '900px';
                iframe.style.border = 'none';
                mainContent.appendChild(iframe);
            }
        }
        // 同時移除 PDF 匯出按鈕
        document.querySelectorAll('a.js-export-timetable-button').forEach(el => el.remove());

        // 防止 timetable-wrapper 被重新插入：監聽 mainContent 子節點
        if (mainContent && !mainContent._timetableBlocker) {
            const observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1 && node.classList.contains('timetable-wrapper')) {
                            node.remove();
                        }
                    });
                });
            });
            observer.observe(mainContent, { childList: true });
            mainContent._timetableBlocker = true;
        }
    }

    // === Add flip-on-hover animation to labels in .labels-set ===
    function initLabelFlip() {
        document.querySelectorAll('.labels-set .label:not(.flip-init)').forEach(label => {
            label.classList.add('flip-init');
            label.style.transformStyle = 'preserve-3d';
            label.style.backfaceVisibility = 'hidden';
            label.style.transition = 'transform 0.6s cubic-bezier(.77,0,.18,1)';

            label.addEventListener('mouseover', (e) => {
                if (!label.contains(e.relatedTarget)) {
                    label.style.transform = 'rotateX(-15deg) scale(1.08)';
                }
            });
            label.addEventListener('mouseout', (e) => {
                if (!label.contains(e.relatedTarget)) {
                    label.style.transform = 'rotateX(0deg) scale(1)';
                }
            });
        });
    }

    // === 依序動畫：滑鼠移到整個卡片時，讓 labels 順序放大再縮小 ===
    function initCardSequentialFlip() {
        document.querySelectorAll('.fusion-card-item.short-assignment:not(.flip-card-init)').forEach(card => {
            card.classList.add('flip-card-init');
            let flipTimeouts = [];
            card.addEventListener('mouseenter', () => {
                const labels = card.querySelectorAll('.labels-set .label');
                const badges = card.querySelectorAll('.badge');
                let delay = 0;
                labels.forEach(label => {
                    flipTimeouts.push(setTimeout(() => {
                        const deg = (Math.random() * 6 - 3).toFixed(2);
                        label.style.transition = 'transform 0.3s cubic-bezier(0.68,-0.55,0.27,1.55)';
                        label.style.transform = `scale(1.18) rotate(${deg}deg)`;
                        setTimeout(() => {
                            label.style.transition = 'transform 0.18s cubic-bezier(.77,0,.18,1)';
                            label.style.transform = 'scale(1) rotate(0deg)';
                        }, 200);
                    }, delay));
                    delay += 80;
                });
                badges.forEach(badge => {
                    flipTimeouts.push(setTimeout(() => {
                        const deg = (Math.random() * 6 - 3).toFixed(2);
                        badge.style.transition = 'transform 0.3s cubic-bezier(0.68,-0.55,0.27,1.55), box-shadow 0.3s';
                        badge.style.transform = `scale(1.18) rotate(${deg}deg)`;
                        badge.style.boxShadow = '0 0 8px rgba(0,200,255,0.8)';
                        setTimeout(() => {
                            badge.style.transition = 'transform 0.18s cubic-bezier(.77,0,.18,1), box-shadow 0.18s';
                            badge.style.transform = 'scale(1) rotate(0deg)';
                            badge.style.boxShadow = '';
                        }, 200);
                    }, delay));
                    delay += 80;
                });
            });
            card.addEventListener('mouseleave', () => {
                flipTimeouts.forEach(t => clearTimeout(t));
                flipTimeouts = [];
                const labels = card.querySelectorAll('.labels-set .label');
                const badges = card.querySelectorAll('.badge');
                labels.forEach(label => {
                    label.style.transition = 'transform 0.18s cubic-bezier(.77,0,.18,1)';
                    label.style.transform = 'scale(1) rotate(0deg)';
                });
                badges.forEach(badge => {
                    badge.style.transition = 'transform 0.18s cubic-bezier(.77,0,.18,1), box-shadow 0.18s';
                    badge.style.transform = 'scale(1) rotate(0deg)';
                    badge.style.boxShadow = '';
                });
            });
        });
    }

    // 更新初始化函數
    function init() {
        enhanceHeader();
        replaceMenuTitles();
        addLightWaveToCards();
        initSidebarAnimation();
        replaceTimetableWithIframe();
        initLabelFlip(); // label flip
        initCardSequentialFlip(); // card sequential flip
    }
    init();

})();