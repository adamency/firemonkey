// ----------------- Locale Maker ----------------------
// Locale Maker requires "downloads" permission to save the generated locale in folders
// localStorage.setItem('dark', 'true') for Dark theme

class LocaleMaker {

  constructor() {
    // --- Light/Dark Theme
    document.body.classList.toggle('dark', localStorage.getItem('dark') === 'true');

    this.setDefault = this.setDefault.bind(this);
    this.import = this.import.bind(this);
    this.export = this.export.bind(this);
    this.exportAll = this.exportAll.bind(this);

    this.trTemplate = document.querySelector('template').content.firstElementChild;
    this.tbody = document.querySelector('tbody');
    this.footer = document.querySelector('tfoot td');
    this.select = document.querySelector('#locale');
    this.select.addEventListener('change', (e) => {
      if (!e.target.value) { return; }
      this.footer.textContent = '';                           // reset
      const lang = e.target.value;
      fetch(`/_locales/${lang}/messages.json`)
      .then(response => response.json())
      .then(data =>  this.setLocale(data))
      .catch(error => this.notify(`"${lang}" is not available. ${error.message}`));
    });

    // --- import/export
    document.getElementById('import').addEventListener('change', this.import);
    document.getElementById('export').addEventListener('click', this.export);
    document.getElementById('exportAll').addEventListener('click', this.exportAll);

    // --- help popup
    const details = document.querySelector('details');
    document.body.addEventListener('click', (e) =>
      !details.contains(e.explicitOriginalTarget) && (details.open = false)
    );

    // --- i18n
    this.defaultLocale = browser.runtime.getManifest().default_locale;
    if (!this.defaultLocale) { this.notify('"default_locale" is not set'); }

    fetch(`/_locales/${this.defaultLocale}/messages.json`)
    .then(response => response.json())
    .then(data =>  this.setDefault(data))
    .catch(error => this.notify(`"default_locale" ${this.defaultLocale} is not available. ${error.message}`));

    this.locales = [];
    [...this.select.options].forEach(item => {
      if (!item.value) { return; }
      else if (item.value === this.defaultLocale) {
        item.prepend('\u2705 ');
        return;
      }

      const lang = item.value;
      fetch(`/_locales/${lang}/messages.json`)
      .then(response => response.json())
      .then(response => {
        item.prepend('✔ ');
        this.locales.push(lang);
      })
      .catch(() => {});                                     // suppress error
    });
  }


  setDefault(data) {
    this.default = JSON.parse(JSON.stringify(data));
    const docfrag = document.createDocumentFragment();

    Object.keys(data).forEach(item => {
      if (item === 'extensionName') { return; }             // keep extension name
      const tr = this.trTemplate.cloneNode(true);
      tr.children[0].textContent = this.showSpecial(data[item].message);
      tr.children[1].children[0].id = item;
      tr.children[1].children[0].setAttribute('pattern', this.showSpecial(data[item].message));
      docfrag.appendChild(tr);
    });
    this.tbody.appendChild(docfrag);

    this.inputs = document.querySelectorAll('td input');

    // --- paste multiple 3+ lines
    document.body.addEventListener('paste', (e) => {
      const text = e.clipboardData.getData('text/plain');
      const lines = text.split(/[\r\n]+/);
      if (lines.length > 3) {
        e.preventDefault();
        const idx = [...document.querySelectorAll('td input')].indexOf(document.activeElement);
        this.inputs.forEach((item, index) => index >= idx && lines[0] && (item.value = lines.shift().trim()));
      }
  });
  }

  setLocale(data) {
    this.inputs.forEach(item => data[item.id] && (item.value = this.showSpecial(data[item.id].message)));
  }

  showSpecial(str) {
    return JSON.stringify(str).slice(1, -1);
  }

  import(e) {
    this.footer.textContent = '';                           // reset
    const file = e.target.files[0];
    switch (true) {
      case !file:
        this.notify('There was an error with the operation.');
        return;

      case !['text/plain', 'application/json'].includes(file.type): // check file MIME type
        this.notify('Unsupported File Format.');
        return;
    }

    const reader  = new FileReader();
    reader.onloadend = () => {
      try { this.setLocale(JSON.parse(reader.result)); }    // Parse JSON
      catch(e) { this.notify(e.message ); }                 // display the error
    };
    reader.onerror = () => this.notify('There was an error with reading the file.');
    reader.readAsText(file);
  }

  export() {
    if (!this.default) { return; }

    let data = JSON.parse(JSON.stringify(this.default));
    this.inputs.forEach(item => item.value && (data[item.id].message = JSON.parse(`"${item.value}"`)));
    const filename = this.select.value ? this.select.value + '/messages.json' : 'messages.json';
    this.saveFile(data, filename);
  }

  exportAll() {
    if (!this.default) { return; }

    const defaultString = JSON.stringify(this.default);
    const folder = !browser.downloads ? '' : 'locale-maker/';
    this.saveFile(JSON.parse(defaultString), `${folder}${this.defaultLocale}/messages.json`, false); // save default locale

    this.locales.forEach(lang => {
      fetch(`/_locales/${lang}/messages.json`)
      .then(response => response.json())
      .then(thisLang => {
        let data = JSON.parse(defaultString);
        Object.entries(thisLang).forEach(([key, value]) => key !== 'extensionName' && value && (data[key] = value));
        this.saveFile(data, `${folder}${lang}/messages.json`, false);
      })
      .catch(() => {});                                     // suppress error
    });
  }

  saveFile(data, filename, saveAs = true) {
    if (!browser.downloads) {
      const a = document.createElement('a');
      a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(data);
      a.setAttribute('download', filename);
      a.dispatchEvent(new MouseEvent('click'));
      return;
    }

    data = JSON.stringify(data, null, 2);
    const blob = new Blob([data], {type: 'text/plain;charset=utf-8'});
    browser.downloads.download({
      url: URL.createObjectURL(blob),
      filename,
      saveAs,
      conflictAction: 'uniquify'
    });
  }

  notify(message) {
    this.footer.textContent = '\u26a0\ufe0f ' + message;
  }
}
new LocaleMaker();