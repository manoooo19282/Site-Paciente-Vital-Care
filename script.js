(() => {
  const data = window.VITALCARE_DATA;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const escapeHTML = (value) => String(value).replace(/[&<>'"]/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  function renderBasics() {
    $('#greeting').textContent = greeting();
    $('#patientName').textContent = data.patient.name;
    $('#currentStage').textContent = data.status.currentStage;
    $('#stageMessage').textContent = data.status.message;
    $('#statusBadge').textContent = data.status.label;
    $('#waitTime').textContent = `${data.status.waitMinutes} min`;
    $('#queuePosition').textContent = `${data.status.queuePosition}º`;
    $('#aheadText').textContent = `${data.status.peopleAhead} ${data.status.peopleAhead === 1 ? 'pessoa' : 'pessoas'} à sua frente`;
    $('#priorityText').textContent = data.status.priority;
    $('#precheckTime').textContent = `às ${data.status.precheckTime}`;
    $('#vitalsTime').textContent = data.status.vitalsTime;
    $('#progressBar').style.width = `${data.status.progress}%`;
    $('#progressText').textContent = `${data.status.progress}%`;
  }

  function renderJourney() {
    $('#journeyList').innerHTML = data.journey.map((item) => {
      const icon = item.state === 'done' ? '✓' : item.state === 'current' ? '●' : '○';
      return `<li class="journey-item ${escapeHTML(item.state)}">
        <span class="journey-marker" aria-hidden="true">${icon}</span>
        <div class="journey-copy"><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.description)}</p></div>
        <span class="journey-time">${escapeHTML(item.time)}</span>
      </li>`;
    }).join('');
  }

  function renderVitals() {
    $('#vitalsGrid').innerHTML = data.vitals.map((v) => `<article class="vital-card" data-tone="${escapeHTML(v.tone)}">
      <div class="vital-top"><span>${escapeHTML(v.label)}</span><span class="vital-symbol" aria-hidden="true">${escapeHTML(v.icon)}</span></div>
      <strong>${escapeHTML(v.value)} <small>${escapeHTML(v.unit)}</small></strong>
      <small>${escapeHTML(v.note)}</small>
    </article>`).join('');
  }

  function renderDetails(target, items) {
    $(target).innerHTML = items.map((item) => `<div class="detail-row"><dt>${escapeHTML(item.label)}</dt><dd>${escapeHTML(item.value)}</dd></div>`).join('');
  }

  function renderUpdates() {
    $('#updatesList').innerHTML = data.updates.map((u) => `<article class="update-card">
      <span class="update-dot" aria-hidden="true">${u.type === 'success' ? '✓' : 'i'}</span>
      <div><strong>${escapeHTML(u.title)}</strong><p>${escapeHTML(u.text)}</p><span class="update-time">${escapeHTML(u.time)}</span></div>
    </article>`).join('');
  }

  let toastTimer;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) {
      toast('A leitura em voz alta não está disponível neste navegador.');
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'pt-BR';
    utter.rate = 0.96;
    window.speechSynthesis.speak(utter);
  }

  function statusSpeech() {
    return `${greeting()}, ${data.patient.name}. Sua etapa atual é ${data.status.currentStage}. Sua estimativa de espera é de aproximadamente ${data.status.waitMinutes} minutos. Você está na posição ${data.status.queuePosition} da fila, com ${data.status.peopleAhead} pessoas à sua frente. Sua prioridade preliminar registrada é ${data.status.priority}.`;
  }

  function guidanceSpeech() {
    return `${data.patient.name}, permaneça próxima à área de espera e acompanhe as atualizações neste portal. Se seus sintomas piorarem, procure a equipe da unidade imediatamente.`;
  }

  function pageSummarySpeech() {
    const vitals = data.vitals.map(v => `${v.label}: ${v.value} ${v.unit}`).join('. ');
    return `${statusSpeech()} Últimos sinais vitais: ${vitals}. O próximo passo previsto é avaliação médica.`;
  }

  function bindControls() {
    $('#listenStatus').addEventListener('click', () => speak(statusSpeech()));
    $('#listenGuidance').addEventListener('click', () => speak(guidanceSpeech()));
    $('#readPage').addEventListener('click', () => speak(pageSummarySpeech()));

    $('#refreshStatus').addEventListener('click', () => {
      const now = new Date();
      $('#lastUpdated').textContent = `às ${now.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}`;
      toast('Status atualizado. Nenhuma nova etapa no momento.');
    });

    $('#contrastToggle').addEventListener('click', (e) => {
      const on = document.body.classList.toggle('high-contrast');
      e.currentTarget.setAttribute('aria-pressed', String(on));
      localStorage.setItem('vc-contrast', on ? '1' : '0');
      toast(on ? 'Alto contraste ativado.' : 'Alto contraste desativado.');
    });

    $('#fontToggle').addEventListener('click', () => {
      const enlarged = document.documentElement.style.getPropertyValue('--font-scale') === '1.08';
      document.documentElement.style.setProperty('--font-scale', enlarged ? '1' : '1.08');
      localStorage.setItem('vc-font', enlarged ? '0' : '1');
      toast(enlarged ? 'Tamanho do texto restaurado.' : 'Texto aumentado.');
    });

    $('#motionToggle').addEventListener('click', () => {
      const on = document.body.classList.toggle('reduced-motion');
      localStorage.setItem('vc-motion', on ? '1' : '0');
      toast(on ? 'Animações reduzidas.' : 'Animações restauradas.');
    });

    const navLinks = [...$$('.bottom-nav a')];
    const sections = ['inicio','jornada','dados','ajuda'].map(id => document.getElementById(id)).filter(Boolean);
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${visible.target.id}`));
    }, {rootMargin:'-30% 0px -60% 0px', threshold:[0,.2,.6]});
    sections.forEach(s => observer.observe(s));
  }

  function restorePreferences() {
    if (localStorage.getItem('vc-contrast') === '1') document.body.classList.add('high-contrast');
    if (localStorage.getItem('vc-font') === '1') document.documentElement.style.setProperty('--font-scale','1.08');
    if (localStorage.getItem('vc-motion') === '1') document.body.classList.add('reduced-motion');
  }

  function registerSW() {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  restorePreferences();
  renderBasics();
  renderJourney();
  renderVitals();
  renderDetails('#anamnesisList', data.anamnesis);
  renderDetails('#attendanceInfo', data.attendanceInfo);
  renderUpdates();
  bindControls();
  registerSW();
})();
