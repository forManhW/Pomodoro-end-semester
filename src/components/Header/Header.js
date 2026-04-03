import './Header.css';
import Logo from '../../assets/images/pomodoro.svg';
import Home from '../../assets/images/home.svg';
import Tasks from '../../assets/images/tasks.svg';
import Statistics from '../../assets/images/statistics.svg';
import SettingsImg from '../../assets/images/settings.svg';
import Close from '../../assets/images/Close.svg';

class Header {
    #header;
    #nav;
    #popup;
    #settings = null;
    #menu = [
        { title: 'Home',       icon: Home,        link: '/'              },
        { title: 'Tasks',      icon: Tasks,       link: '/tasks.html'    },
        { title: 'Statistics', icon: Statistics,  link: '/statistics.html' },
        { title: 'Settings',   icon: SettingsImg, link: null             },
    ];

    constructor() {
        this.#init();
    }

    #init() {
        this.#header = document.querySelector('header');

        this.#header.innerHTML = `
            <img src="${Logo}" alt="Pomodoro Logo" class="header-logo" />
            <div class="navigation"></div>
            <div class="mobile-nav"></div>
        `;

        this.#nav = this.#header.querySelector('.navigation');

        this.#buildNavItems();
        this.#buildMobileNavItems();

        this.#header.querySelector('.setting-toggle')
            .addEventListener('click', () => this.#togglePopup());
    }

    #buildNavItems() {
        this.#menu.forEach(item => {
            let navItem;

            if (item.title === 'Settings') {
                navItem = document.createElement('img');
                navItem.src = item.icon;
                navItem.alt = item.title;
                navItem.classList.add('header-nav', 'setting-toggle', 'cursor-pointer');
            } else {
                navItem = document.createElement('a');
                navItem.href = item.link;
                navItem.innerHTML = `<img src="${item.icon}" alt="${item.title}" class="header-nav cursor-pointer"/>`;

                if (window.location.pathname === item.link) {
                    navItem.classList.add('active-nav');
                }
            }

            this.#nav.appendChild(navItem);
        });

        this.#popup = document.createElement('div');
        this.#popup.classList.add('popup-wrapper');
        this.#popup.addEventListener('click', () => this.#togglePopup());

        const popupContent = document.createElement('div');
        popupContent.classList.add('popup', 'settings-container');
        popupContent.addEventListener('click', (e) => e.stopPropagation());

        this.#popup.appendChild(popupContent);
        this.#nav.appendChild(this.#popup);
    }

    #buildMobileNavItems() {
        const mobileNav = this.#header.querySelector('.mobile-nav');

        this.#menu.forEach(item => {
            const link = document.createElement('a');
            link.href = item.title === 'Settings' ? '/settings.html' : item.link;
            link.classList.add('mobile-nav-item');

            if (window.location.pathname === link.href.replace(window.location.origin, '')) {
                link.classList.add('active-nav');
            }

            link.innerHTML = `<img src="${item.icon}" alt="${item.title}" class="mobile-nav-icon" />
                              <span class="mobile-nav-label">${item.title}</span>`;

            mobileNav.appendChild(link);
        });
    }

    setSettings(settings) {
        this.#settings = settings;
        const closeBtn = document.createElement('img');
        closeBtn.src = Close;
        closeBtn.alt = 'Close';
        closeBtn.classList.add('popup-close-btn', 'cursor-pointer');
        closeBtn.addEventListener('click', () => this.#togglePopup());
        this.#header.querySelector('.popup')?.prepend(closeBtn);
    }

    #togglePopup() {
        const opening = this.#popup.style.display !== 'flex';
        this.#popup.style.display = opening ? 'flex' : 'none';
        if (opening) this.#settings?.reload();
    }
}

export default Header;
