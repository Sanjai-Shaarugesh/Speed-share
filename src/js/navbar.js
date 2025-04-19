window.customElements.define(
    "custom-navbar",
    class extends HTMLElement {
      constructor() {
        super();
        const root = this.attachShadow({ mode: "open" });
        root.innerHTML = `
      <style>
        :host {
          position: relative;
          display: block;
          padding: 15px 15px 15px 15px;
          text-align: center;
          background-color: var(--nav-bg);
          position: fixed;
          width: 100%;
          top: env(safe-area-inset-top);
        }
        .nav {
          display: flex;
          flex-direction: row;
          gap: 10px;
        }
        h1 {
          margin: 0;
          font-size: 1em;
          font-weight: 700;
          color: #fff;
        }
        #back-btn {
          width: 24px;
          height: 24px;
          display: none;
          color: #fff;
          font-size: 1em;
          font-weight: 700;
          text-decoration: none;
        }
      </style>
      <div class="nav">
        <a id="back-btn">
        <svg xmlns="http://www.w3.org/2000/svg" class="ionicon" viewBox="0 0 512 512"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M328 112L184 256l144 144"/></svg>
        </a>
        <div><h1 id="nav-title"></h2></div>
      </div>
      `;
      }
  
      // Called on start
      connectedCallback() {
        const self = this;
  
        // Listen to our page change events
        const body = document.querySelector("body");
        const navTitle = self.shadowRoot.getElementById("nav-title");
  
        body.addEventListener("page-changed", (event) => {
          const title = event.detail.page;
          navTitle.innerHTML = title;
  
          const canGoBack = event.detail.back;
          if (canGoBack) {
            self.shadowRoot.getElementById("back-btn").style.display = "block";
          } else {
            self.shadowRoot.getElementById("back-btn").style.display = "none";
          }
        });
  
        const backBtn = self.shadowRoot.getElementById("back-btn");
        backBtn.addEventListener("click", (event) => {
          history.back();
        });
      }
    }
  );