(() => {
  const dialog = document.querySelector('.booking-dialog');
  const formHost = document.querySelector('#booking-form');
  const progressLabel = document.querySelector('#step-label');
  const progressFill = document.querySelector('#progress-fill');
  const toast = document.querySelector('.toast');
  const state = { step: 1, date: '', name: '', age: '', gender: '', phone: '', social: '', intention: '', terms: false, payment: '' };
  let toastTimer;
  const safe = (value) => String(value || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function notify(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function setStep(next) {
    state.step = next;
    render();
  }

  function dateStep() {
    const options = [
      ['Jueves · grupo 40–55', 'Conversaciones tranquilas · Quito'],
      ['Viernes · grupo 30–45', 'Una sobremesa para salir de la rutina · Quito'],
      ['Sábado · grupo 25–37', 'Rondas ligeras y nuevas perspectivas · Quito']
    ];
    return `<div class="form-kicker">ELIGE CUÁNDO</div><h2 id="booking-title">¿Qué noche va contigo?</h2><p class="form-intro">Selecciona un grupo de ejemplo para explorar el proceso. Las próximas fechas oficiales se anunciarán pronto.</p><div class="choice-list">${options.map(([name, detail]) => `<button class="choice-card ${state.date === name ? 'selected' : ''}" type="button" data-choice-date="${safe(name)}"><span class="choice-radio"></span><span class="choice-copy"><b>${safe(name)}</b><small>${safe(detail)} · fecha por anunciar</small></span><span class="choice-arrow">↗</span></button>`).join('')}</div><div class="booking-actions"><span></span><button class="next-button" data-next ${state.date ? '' : 'disabled'}>CONTINUAR <span>→</span></button></div>`;
  }

  function profileStep() {
    return `<div class="form-kicker">SOBRE TI</div><h2 id="booking-title">Cuéntanos quién viene.</h2><p class="form-intro">Estos campos son solo una muestra de la experiencia. No se guardan ni se envían.</p><label class="form-field"><span>NOMBRE Y APELLIDO</span><input name="name" autocomplete="name" placeholder="Tu nombre" value="${safe(state.name)}" /></label><div class="field-row"><label class="form-field"><span>EDAD</span><input name="age" inputmode="numeric" type="number" min="18" max="100" placeholder="Tu edad" value="${safe(state.age)}" /></label><div class="form-field"><span>VENGO COMO</span><div class="gender-options"><button type="button" class="gender-pill ${state.gender === 'Mujer' ? 'selected' : ''}" data-gender="Mujer">Mujer</button><button type="button" class="gender-pill ${state.gender === 'Hombre' ? 'selected' : ''}" data-gender="Hombre">Hombre</button><button type="button" class="gender-pill ${state.gender === 'Otro' ? 'selected' : ''}" data-gender="Otro">Otro</button></div></div></div><label class="form-field"><span>WHATSAPP DE CONTACTO</span><input name="phone" autocomplete="tel" inputmode="tel" placeholder="+593 · solo para gestionar la reserva" value="${safe(state.phone)}" /></label><div class="booking-actions"><button class="back-button" data-back>← VOLVER</button><button class="next-button" data-next>CONTINUAR <span>→</span></button></div>`;
  }

  function intentionStep() {
    return `<div class="form-kicker">TU INTENCIÓN</div><h2 id="booking-title">¿Con qué ganas llegas?</h2><p class="form-intro">El equipo revisa el perfil antes de confirmar cada lugar y así cuida el balance de la noche.</p><label class="form-field"><span>INSTAGRAM O FACEBOOK <small>(OPCIONAL)</small></span><input name="social" placeholder="@tuusuario o enlace" value="${safe(state.social)}" /></label><label class="form-field"><span>¿QUÉ TE GUSTARÍA ENCONTRAR EN ESTA NOCHE?</span><textarea name="intention" rows="4" placeholder="Una buena conversación, conocer nuevas personas…">${safe(state.intention)}</textarea></label><div class="notice-box">En el sitio real, el equipo usa estos datos para revisar tu solicitud y contactarte sobre la reserva. Esta demo no transmite información.</div><div class="booking-actions"><button class="back-button" data-back>← VOLVER</button><button class="next-button" data-next>REVISAR SOLICITUD <span>→</span></button></div>`;
  }

  function reviewStep() {
    return `<div class="form-kicker">VALIDACIÓN PREVIA</div><h2 id="booking-title">Un repaso antes de continuar.</h2><p class="form-intro">Así se prepara tu solicitud para que el equipo pueda validar el cupo.</p><div class="review-box"><div class="review-line"><span>Noche</span><b>${safe(state.date || 'Sin elegir')}</b></div><div class="review-line"><span>Nombre</span><b>${safe(state.name || '—')}</b></div><div class="review-line"><span>Edad</span><b>${safe(state.age || '—')}</b></div><div class="review-line"><span>Grupo</span><b>${safe(state.gender || '—')}</b></div><div class="review-line"><span>WhatsApp</span><b>${safe(state.phone || '—')}</b></div></div><div class="notice-box"><b>¿Qué sigue?</b> El equipo revisa cada solicitud y confirma si hay cupo. Tras la validación, se completa el pago para emitir tu pase personal con QR.</div><label class="checkbox-row"><input type="checkbox" name="terms" ${state.terms ? 'checked' : ''} /><span>Entiendo que las reservas se validan antes de confirmarse. (Vista de ejemplo)</span></label><div class="booking-actions"><button class="back-button" data-back>← VOLVER</button><button class="next-button" data-next ${state.terms ? '' : 'disabled'}>CONTINUAR <span>→</span></button></div>`;
  }

  function paymentStep() {
    const method = state.payment;
    return `<div class="form-kicker">PAGO Y CONFIRMACIÓN</div><h2 id="booking-title">Tu pase, después de validar.</h2><p class="form-intro">En la experiencia real, el pago se habilita cuando el equipo confirma tu lugar y el precio de la edición.</p><div class="pay-box"><strong>Precio de la próxima edición</strong><p>Se anunciará junto con las fechas. El monto de esta demostración es solo informativo: no hay pedido ni checkout conectado.</p></div><div class="choice-list"><button class="choice-card ${method === 'tarjeta' ? 'selected' : ''}" type="button" data-payment="tarjeta"><span class="choice-radio"></span><span class="choice-copy"><b>Tarjeta · vista de ejemplo</b><small>El procesador real se conectará cuando compartas la configuración.</small></span></button><button class="choice-card ${method === 'transferencia' ? 'selected' : ''}" type="button" data-payment="transferencia"><span class="choice-radio"></span><span class="choice-copy"><b>Otra forma de pago · ejemplo</b><small>Los métodos disponibles dependen de la cuenta de Ágape.</small></span></button></div><div class="notice-box" style="margin-top:12px">Este botón solo muestra el cierre del recorrido. No contacta al procesador, no envía la solicitud y no realiza ningún cobro.</div><div class="booking-actions"><button class="back-button" data-back>← VOLVER</button><button class="next-button" data-finish>FINALIZAR DEMO <span>↗</span></button></div>`;
  }

  function doneStep() {
    return `<div class="form-kicker">RECORRIDO COMPLETO</div><h2 id="booking-title">Así se sentiría tu reserva.</h2><p class="form-intro">Llegaste al final del recorrido interactivo. La solicitud no se envió y no se realizó ningún pago.</p><div class="review-box"><div class="review-line"><span>Noche de ejemplo</span><b>${safe(state.date)}</b></div><div class="review-line"><span>Estado simulado</span><b>Pendiente de validación</b></div><div class="review-line"><span>Pase QR</span><b>Se emitiría tras el pago real</b></div></div><div class="notice-box">Para activar reservas reales hace falta conectar los datos de fechas y aforo, el sistema de validación, el procesador de pagos y los canales de envío de pases que usa Ágape.</div><div class="booking-actions"><span></span><button class="next-button" data-done>VOLVER A LA PÁGINA <span>↗</span></button></div>`;
  }

  function render() {
    progressLabel.textContent = state.step <= 5 ? `PASO ${state.step} DE 5` : 'DEMO COMPLETADA';
    progressFill.style.width = `${Math.min(state.step, 5) * 20}%`;
    formHost.innerHTML = state.step === 1 ? dateStep() : state.step === 2 ? profileStep() : state.step === 3 ? intentionStep() : state.step === 4 ? reviewStep() : state.step === 5 ? paymentStep() : doneStep();
    const input = formHost.querySelector('input:not([type=checkbox]), textarea');
    if (input && state.step > 1) input.focus({ preventScroll: true });
  }

  function openBooking(date = '') {
    state.step = 1;
    state.date = date;
    state.name = state.age = state.gender = state.phone = state.social = state.intention = state.payment = '';
    state.terms = false;
    render();
    if (!dialog.open) dialog.showModal();
  }

  function saveFields() {
    for (const name of ['name', 'age', 'phone', 'social', 'intention']) {
      const node = formHost.querySelector(`[name="${name}"]`);
      if (node) state[name] = node.value.trim();
    }
    const consent = formHost.querySelector('[name="terms"]');
    if (consent) state.terms = consent.checked;
  }

  function validStep() {
    saveFields();
    if (state.step === 1 && !state.date) return notify('Elige una noche de ejemplo para continuar.'), false;
    if (state.step === 2) {
      if (!state.name || !state.age || !state.gender || !state.phone) return notify('Completa los campos obligatorios de ejemplo.'), false;
      if (Number(state.age) < 18 || Number(state.age) > 100) return notify('Ingresa una edad válida.'), false;
      if (state.phone.replace(/\D/g, '').length < 7) return notify('Revisa el número de contacto.'), false;
    }
    if (state.step === 3 && !state.intention) return notify('Cuéntanos brevemente con qué intención llegas.'), false;
    if (state.step === 4 && !state.terms) return notify('Marca la casilla de ejemplo para continuar.'), false;
    return true;
  }

  document.addEventListener('click', (event) => {
    const book = event.target.closest('[data-book]');
    if (book) { openBooking(book.dataset.date || ''); return; }
    if (event.target.closest('.dialog-close')) { dialog.close(); return; }
    if (event.target.closest('[data-choice-date]')) {
      state.date = event.target.closest('[data-choice-date]').dataset.choiceDate;
      render(); return;
    }
    const gender = event.target.closest('[data-gender]');
    if (gender) { state.gender = gender.dataset.gender; render(); return; }
    const payment = event.target.closest('[data-payment]');
    if (payment) { state.payment = payment.dataset.payment; render(); return; }
    if (event.target.closest('[data-next]')) {
      if (validStep()) setStep(state.step + 1);
      return;
    }
    if (event.target.closest('[data-back]')) { saveFields(); setStep(Math.max(1, state.step - 1)); return; }
    if (event.target.closest('[data-finish]')) { setStep(6); return; }
    if (event.target.closest('[data-done]')) { dialog.close(); return; }
    if (event.target.closest('.notice-close')) event.target.closest('.event-notice').remove();
  });

  formHost.addEventListener('input', (event) => {
    if (event.target.name === 'terms') { state.terms = event.target.checked; render(); }
  });

  document.querySelector('.menu-toggle').addEventListener('click', (event) => {
    const nav = document.querySelector('.main-nav');
    const open = nav.classList.toggle('open');
    event.currentTarget.setAttribute('aria-expanded', String(open));
    event.currentTarget.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  });
  document.querySelectorAll('.main-nav a').forEach((link) => link.addEventListener('click', () => {
    document.querySelector('.main-nav').classList.remove('open');
    document.querySelector('.menu-toggle').setAttribute('aria-expanded', 'false');
  }));
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
})();
