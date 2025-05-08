Uploder site for https://www.suasqrf.org/


Local Development Setup Guide

## macOS / Linux Instructions

1. **Install Git**

   * Open **Terminal** (Finder → Applications → Utilities → Terminal).
   * Check if Git is installed:

     ```bash
     git --version
     ```
   * If not found, install via Homebrew:

     ```bash
     /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
     brew install git
     ```
   * Or download from [https://git-scm.com/downloads](https://git-scm.com/downloads) and run the installer.

2. **Install Node.js & npm**

   * Verify installation:

     ```bash
     node --version
     ```
   * If missing, download and run the LTS installer from [https://nodejs.org](https://nodejs.org).

3. **Clone the Repository**

   * In Terminal, navigate to your projects folder (or create one):

     ```bash
     cd ~/Projects
     mkdir suas && cd suas
     ```
   * Clone the repo:

     ```bash
     git clone https://github.com/fkruger/suas_webapp.git
     cd suas_webapp
     ```

4. **Install Dependencies**

   ```bash
   npm install
   ```

5. **Start the Local Web Service**

   ```bash
   npm start
   ```

   * The site will compile and usually open in your browser at [http://localhost:3000](http://localhost:3000).

6. **Stop the Server**

   * In Terminal, press **Ctrl +C**.

---

## Windows Instructions

1. **Install Git for Windows**

   * Download and run from [https://git-scm.com/download/win](https://git-scm.com/download/win).
   * Accept defaults (includes Git Bash and adds Git to PATH).

2. **Install Node.js & npm**

   * Download the LTS Windows installer from [https://nodejs.org](https://nodejs.org).
   * Ensure "Add to PATH" is checked during installation.

3. **Open Git Bash (or PowerShell/Windows Terminal)**

   * Start → Git → Git Bash (recommended).

4. **Clone the Repository**

   ```bash
   cd /c/Users/<YourUserName>/Projects
   mkdir suas && cd suas
   git clone https://github.com/fkruger/suas_webapp.git
   cd suas_webapp
   ```

5. **Install Dependencies**

   ```bash
   npm install
   ```

6. **Start the Local Web Service**

   ```bash
   npm start
   ```

   * Open your browser at [http://localhost:3000](http://localhost:3000) when it finishes compiling.

7. **Stop the Server**

   * In your terminal window, press **Ctrl +C**.

---

**Tips for Both Platforms:**

* If port 3000 is in use, change it:

  ```bash
  PORT=3001 npm start        # macOS/Linux
  set PORT=3001 && npm start # Windows PowerShell
  ```
* If you see missing files errors, ensure you’re in the `suas_webapp` folder and that `public/index.html` exists.
* For dependency errors, delete `node_modules/` and rerun `npm install`.
