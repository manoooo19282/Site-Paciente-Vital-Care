(() => {
  'use strict';

  const cfg = window.VITALCARE_CONFIG;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const TZ = cfg?.timeZone || 'America/Sao_Paulo';
  const state = {
    attendanceId: null,
    raw: {},
    summary: {},
    lastFetchAt: null,
    refreshPromise: null,
    channel: null,
    realtimeStatus: 'CLOSED',
    previousStage: null,
    previousUpdateKey: null,
    nextRefreshAt: null,
    installPrompt: null
  };

  const escapeHTML = (value) => String(value ?? '').replace(/[&<>'"]/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

  if (!cfg || !window.supabase?.createClient) {
    location.replace(cfg?.loginPage || 'login.html');
    return;
  }

  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storage: window.sessionStorage }
  });

  const timeFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const dateFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
  const hourFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' });
  const clockFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' });

  function validDate(value) { const d = value ? new Date(value) : null; return d && !Number.isNaN(d.getTime()) ? d : null; }
  function fmtTime(value, fallback='—') { const d = validDate(value); return d ? timeFmt.format(d) : fallback; }
  function fmtDateTime(value, fallback='—') { const d = validDate(value); return d ? dateTimeFmt.format(d) : fallback; }
  function fmtDate(value, fallback='—') { const d = validDate(value); return d ? dateFmt.format(d) : fallback; }
  function greeting() { const hour=Number(hourFmt.format(new Date())); return hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite'; }
  function titleCase(value='') { return String(value).toLowerCase().replace(/(^|[\s_-])\S/g, s => s.toUpperCase()).replace(/_/g,' '); }
  function maskCPF(value='') { const v=String(value).replace(/\D/g,'').slice(0,11); return v.length===11 ? v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4') : (value||'—'); }
  function compactCount(n, one, many) { return `${n} ${n===1?one:many}`; }
  function formatValue(value) {
    if (value === null || value === undefined || value === '') return 'Não informado';
    if (Array.isArray(value)) return value.length ? value.map(formatValue).join(', ') : 'Nenhum informado';
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (typeof value === 'object') return Object.entries(value).filter(([,v]) => v !== null && v !== '' && v !== false).map(([k,v]) => `${titleCase(k)}: ${formatValue(v)}`).join(' • ') || 'Não informado';
    return String(value);
  }
  function colorName(cor) { const c=String(cor||'').toUpperCase(); return ({AZUL:'Azul',VERDE:'Verde',AMARELO:'Amarela',LARANJA:'Laranja',VERMELHO:'Vermelha'})[c] || (cor || 'Não informada'); }
  function sourceName(source) {
    const s=String(source||'').toLowerCase();
    if (!s) return 'Cálculo do VitalCare';
    if (s.includes('histor')) return 'Histórico recente da unidade';
    if (s.includes('padrao') || s.includes('padrão') || s.includes('default')) return 'Parâmetro operacional da unidade';
    if (s.includes('fila')) return 'Situação atual da fila';
    return titleCase(source);
  }
  function safeText(el, value, fallback='—') { const node=typeof el==='string'?$(el):el; if(node) node.textContent=(value===null||value===undefined||value==='')?fallback:String(value); }

  let toastTimer;
  function toast(message) { const el=$('#toast'); if(!el)return; el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3300); }
  function announce(message) { safeText('#screenReaderStatus',message,''); }
  function setBusy(on) { $('#refreshStatus')?.classList.toggle('loading-dim', on); }

  async function ensureSession() {
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session) { location.replace(cfg.loginPage); return false; }
    let id = sessionStorage.getItem('vc-atendimento-id');
    if (!id) {
      const { data, error: qError } = await client.from('atendimentos').select('id').order('inicio_em', { ascending:false }).limit(1);
      if (qError || !data?.length) { await logout(false); return false; }
      id = data[0].id; sessionStorage.setItem('vc-atendimento-id', id);
    }
    state.attendanceId = id;
    return true;
  }

  async function logout(confirmFirst=true) {
    if (confirmFirst && !window.confirm('Deseja sair do Minha Fila neste dispositivo?')) return;
    try { if (state.channel) await client.removeChannel(state.channel); } catch (_) {}
    await client.auth.signOut({ scope:'local' }).catch(()=>{});
    sessionStorage.removeItem('vc-atendimento-id');
    sessionStorage.removeItem('vc-login-em');
    location.replace(cfg.loginPage);
  }

  async function maybeOne(table, queryBuilder) {
    try { let q=client.from(table).select('*');q=queryBuilder?queryBuilder(q):q;const {data,error}=await q.maybeSingle();return error?null:(data||null); } catch (_) { return null; }
  }
  async function many(table, queryBuilder) {
    try { let q=client.from(table).select('*');q=queryBuilder?queryBuilder(q):q;const {data,error}=await q;return error?[]:(data||[]); } catch (_) { return []; }
  }
  async function fetchSummary(id) {
    try { const {data,error}=await client.rpc('minha_fila_resumo',{p_atendimento_id:id});if(!error&&data?.ok)return data; } catch (_) {}
    return {};
  }

  async function fetchAll() {
    const id=state.attendanceId;
    const atendimento=await maybeOne('atendimentos',q=>q.eq('id',id));
    if(!atendimento)throw new Error('Sua sessão de acompanhamento expirou. Entre novamente.');
    const [paciente,unidade,triagem,sinais,classificacoes,fila,reavaliacoes,eventos,exames,encaminhamentos,prescricoes,procedimentos,diagnosticos,evolucoes,consentimentos,anexos,solicitacoesReavaliacao,summary]=await Promise.all([
      maybeOne('pacientes',q=>q.eq('id',atendimento.paciente_id)),
      maybeOne('unidades',q=>q.eq('id',atendimento.unidade_id)),
      maybeOne('respostas_triagem',q=>q.eq('atendimento_id',id)),
      many('sinais_vitais',q=>q.eq('atendimento_id',id).order('medido_em',{ascending:false})),
      many('classificacoes',q=>q.eq('atendimento_id',id).order('criado_em',{ascending:false})),
      maybeOne('fila_atendimento',q=>q.eq('atendimento_id',id)),
      many('reavaliacoes',q=>q.eq('atendimento_id',id).order('criado_em',{ascending:false})),
      many('eventos_atendimento',q=>q.eq('atendimento_id',id).order('criado_em',{ascending:false}).limit(50)),
      many('solicitacoes_exames',q=>q.eq('atendimento_id',id).order('criado_em',{ascending:false})),
      many('encaminhamentos',q=>q.eq('atendimento_id',id).order('criado_em',{ascending:false})),
      many('prescricoes',q=>q.eq('atendimento_id',id).order('criado_em',{ascending:false})),
      many('procedimentos',q=>q.eq('atendimento_id',id).order('criado_em',{ascending:false})),
      many('diagnosticos',q=>q.eq('atendimento_id',id).order('criado_em',{ascending:false})),
      many('evolucoes_clinicas',q=>q.eq('atendimento_id',id).order('criado_em',{ascending:false})),
      many('consentimentos',q=>q.eq('atendimento_id',id).order('registrado_em',{ascending:false})),
      many('anexos_prontuario',q=>q.eq('atendimento_id',id).order('criado_em',{ascending:false})),
      many('solicitacoes_reavaliacao_paciente',q=>q.eq('atendimento_id',id).order('criado_em',{ascending:false})),
      fetchSummary(id)
    ]);
    state.raw={paciente,atendimento,unidade,triagem,sinais,classificacoes,fila,reavaliacoes,eventos,exames,encaminhamentos,prescricoes,procedimentos,diagnosticos,evolucoes,consentimentos,anexos,solicitacoesReavaliacao};
    state.summary=summary||{};state.lastFetchAt=new Date();state.nextRefreshAt=Date.now()+(cfg.refreshIntervalMs||20000);
  }

  function stageInfo() {
    const {atendimento,fila}=state.raw;const s=state.summary||{};const flow=s.etapa_profissional||'';
    if(atendimento?.status==='concluido'||fila?.status==='finalizado'||flow==='finalizado')return{key:'finalizado',label:'Finalizado',stage:'Atendimento finalizado',message:'Seu atendimento foi concluído. Confira abaixo os registros disponibilizados.',progress:100,next:'Confira as orientações e os registros adicionados pela equipe.',header:'Atendimento concluído'};
    if(atendimento?.status==='cancelado'||fila?.status==='cancelado'||flow==='cancelado')return{key:'cancelado',label:'Encerrado',stage:'Atendimento encerrado',message:'Este atendimento foi encerrado pela unidade.',progress:100,next:'Em caso de dúvida, procure a equipe da unidade.',header:'Atendimento encerrado'};
    if(fila?.status==='chamado')return{key:'chamado',label:'Chamado',stage:'Você foi chamado',message:fila?.mensagem_paciente||'Dirija-se ao setor ou sala informados pela equipe.',progress:75,next:'Dirija-se agora ao local indicado pela equipe e mantenha este portal disponível.',header:'Chamado para atendimento'};
    if(atendimento?.status==='em_atendimento'||fila?.status==='em_atendimento'||flow==='em_atendimento')return{key:'em_atendimento',label:'Em atendimento',stage:'Em atendimento médico',message:'Seu atendimento profissional está em andamento.',progress:85,next:'Aguarde as orientações da equipe. Novos registros aparecerão automaticamente aqui.',header:'Atendimento em andamento'};
    if(flow==='aguardando_reavaliacao'||s.reavaliacao_solicitada)return{key:'reavaliacao',label:'Reavaliação',stage:'Aguardando reavaliação médica',message:fila?.mensagem_paciente||'Sua reavaliação foi solicitada e a equipe foi avisada.',progress:65,next:'Permaneça próximo à equipe. Sua solicitação de reavaliação está sinalizada no painel profissional.',header:'Reavaliação solicitada'};
    if(atendimento?.status==='em_preenchimento')return{key:'preenchimento',label:'Em andamento',stage:'Pré-atendimento em andamento',message:'Seu cadastro e suas aferições ainda estão sendo concluídos.',progress:35,next:'Conclua as etapas do pré-atendimento. Assim que terminar, os dados ficam disponíveis para a equipe.',header:'Pré-atendimento em andamento'};
    return{key:'aguardando',label:'Em espera',stage:'Aguardando avaliação médica',message:fila?.mensagem_paciente||'Seu pré-atendimento foi concluído e seus dados já estão disponíveis para a equipe.',progress:60,next:'Permaneça próximo à área de espera. A fila é atualizada conforme prioridades clínicas e movimentações da unidade.',header:'Atendimento em andamento'};
  }

  function renderBasics() {
    const {paciente,atendimento,fila,classificacoes,triagem,sinais,unidade}=state.raw;const info=stageInfo();const latestClass=classificacoes?.[0];const latestVital=sinais?.[0];
    safeText('#greeting',greeting());safeText('#patientName',paciente?.nome_social||paciente?.nome||'Paciente');safeText('#profileButton',(paciente?.nome_social||paciente?.nome||'P').trim().charAt(0).toUpperCase());
    safeText('#unitName',unidade?.nome||'Unidade VitalCare');safeText('#recordNumber',paciente?.numero_prontuario||'—');safeText('#headerStatusText',info.header);
    safeText('#currentStage',info.stage);safeText('#stageMessage',info.message);safeText('#statusBadge',info.label);safeText('#progressText',`${info.progress}%`);if($('#progressBar'))$('#progressBar').style.width=`${info.progress}%`;
    safeText('#nextStepTitle',info.stage);safeText('#nextStepText',info.next);
    const loc=[fila?.setor,fila?.sala?`Sala ${fila.sala}`:null].filter(Boolean).join(' · ');safeText('#locationHint',loc,'');
    const position=Number(state.summary.posicao_fila??0);const ahead=Number(state.summary.pessoas_a_frente??Math.max(position-1,0));const wait=state.summary.tempo_estimado_minutos;
    safeText('#waitTime',(wait===null||wait===undefined||['chamado','em_atendimento','finalizado','cancelado'].includes(fila?.status))?(fila?.status==='chamado'?'Agora':'—'):`${wait} min`);
    safeText('#queuePosition',position>0?`${position}º`:(fila?.status==='chamado'?'Chamado':'—'));
    safeText('#aheadText',position>0?`${ahead} ${ahead===1?'pessoa':'pessoas'} à sua frente`:(fila?.status==='chamado'?'Dirija-se ao atendimento':'Sem posição ativa no momento'));
    safeText('#priorityText',colorName(latestClass?.cor));safeText('#priorityLabel',latestClass?.preliminar===false?'Prioridade atual':'Prioridade preliminar');safeText('#priorityNote',latestClass?.preliminar===false?'atualizada após avaliação profissional':'registrada no pré-atendimento');
    const priorityCard=$('#priorityText')?.closest('.summary-card');if(priorityCard)priorityCard.dataset.priority=String(latestClass?.cor||'').toLowerCase();
    const precheckAt=latestClass?.criado_em||triagem?.atualizado_em||latestVital?.medido_em||atendimento?.inicio_em;safeText('#precheckTime',precheckAt?`às ${fmtTime(precheckAt)}`:'—');safeText('#vitalsTime',latestVital?.medido_em?fmtTime(latestVital.medido_em):'—');
    safeText('#lastUpdated',`às ${fmtTime(state.lastFetchAt)}`);safeText('#queueSource',sourceName(state.summary?.estimativa_fonte));safeText('#waitSourceDetail',sourceName(state.summary?.estimativa_fonte));
    safeText('#autoUpdateDetail',state.realtimeStatus==='SUBSCRIBED'?'Tempo real + verificação periódica':'Verificação periódica');
    updateFreshness();updateReassessmentButton();
    if(state.previousStage&&state.previousStage!==info.key){toast(`Atualização: ${info.stage}.`);announce(`Seu atendimento foi atualizado. ${info.stage}.`);}state.previousStage=info.key;
  }

  function renderVitals() {
    const v=state.raw.sinais?.[0]||{};const cards=[
      {label:'Pressão arterial',value:(v.pressao_sistolica!=null||v.pressao_diastolica!=null)?`${v.pressao_sistolica??'—'}/${v.pressao_diastolica??'—'}`:'—',unit:'mmHg',note:v.status_medicao==='manual'?'Aferição profissional':'Última aferição',icon:'↕',tone:'blue'},
      {label:'Frequência cardíaca',value:v.bpm??'—',unit:'bpm',note:'Pulso registrado',icon:'♥',tone:'rose'},
      {label:'Saturação de oxigênio',value:v.spo2??'—',unit:'%',note:'SpO₂',icon:'◉',tone:'teal'},
      {label:'Temperatura',value:v.temperatura!=null?String(v.temperatura).replace('.',','):'—',unit:'°C',note:'Temperatura corporal',icon:'⌁',tone:'amber'}
    ];
    if(v.glicemia_estimada!=null)cards.push({label:v.glicemia_experimental?'Glicemia estimada':'Glicemia',value:String(v.glicemia_estimada).replace('.',','),unit:'mg/dL',note:v.glicemia_experimental?'Medição experimental — não diagnóstica':'Valor registrado',icon:'◇',tone:'green'});
    $('#vitalsGrid').innerHTML=cards.map(x=>`<article class="vital-card" data-tone="${escapeHTML(x.tone)}"><div class="vital-top"><span>${escapeHTML(x.label)}</span><span class="vital-symbol" aria-hidden="true">${escapeHTML(x.icon)}</span></div><strong>${escapeHTML(x.value)} <small>${escapeHTML(x.unit)}</small></strong><small>${escapeHTML(x.note)}</small></article>`).join('');
    const notes=[];if(v.status_medicao)notes.push(`Status: ${titleCase(v.status_medicao)}`);if(v.qualidade&&Object.keys(v.qualidade).length)notes.push(`Qualidade registrada: ${formatValue(v.qualidade)}`);if(v.glicemia_experimental&&v.glicemia_estimada!=null)notes.push('A glicemia exibida é experimental e não substitui medição clínica validada.');
    safeText('#vitalsFootnote',notes.length?notes.join(' • '):'Exibindo a aferição mais recente registrada no prontuário.');
  }

  function addDetail(items,label,value){if(value!==null&&value!==undefined&&value!==''&&!(Array.isArray(value)&&!value.length))items.push({label,value:formatValue(value)});}
  function humanKey(key){return titleCase(String(key).replace(/^nivel_/,'intensidade_').replace(/^tempo_/,'tempo_'));}
  function buildAnamnesis(){const t=state.raw.triagem||{};const items=[];addDetail(items,'Queixa principal',t.queixa_principal);addDetail(items,'Sintomas informados',t.sintomas);addDetail(items,'Alterações percebidas',t.alteracoes_percebidas);addDetail(items,'Condições preexistentes',t.comorbidades);addDetail(items,'Medicamentos em uso',t.medicamentos);addDetail(items,'Alergias',t.alergias);if(t.vulnerabilidades&&Object.keys(t.vulnerabilidades).length)addDetail(items,'Vulnerabilidades informadas',t.vulnerabilidades);Object.entries(t.respostas_adicionais||{}).forEach(([k,v])=>addDetail(items,humanKey(k),v));if(!items.length)items.push({label:'Anamnese',value:'Nenhuma informação de anamnese disponível neste atendimento.'});return items;}

  function buildAttendanceInfo(){
    const {paciente:p,atendimento:a,unidade:u,fila:f,sinais,reavaliacoes,diagnosticos,prescricoes,exames,encaminhamentos,procedimentos,evolucoes,consentimentos,anexos,solicitacoesReavaliacao}=state.raw;const info=stageInfo();const items=[];
    addDetail(items,'Número do prontuário',p?.numero_prontuario);addDetail(items,'Nome completo',p?.nome);if(p?.nome_social)addDetail(items,'Nome social',p.nome_social);addDetail(items,'Data de nascimento',p?.data_nascimento?fmtDate(`${p.data_nascimento}T12:00:00-03:00`):null);addDetail(items,'Sexo / gênero registrado',p?.sexo);addDetail(items,'CPF',p?.cpf?maskCPF(p.cpf):null);addDetail(items,'Cartão SUS',p?.cartao_sus);addDetail(items,'Telefone',p?.telefone);addDetail(items,'E-mail',p?.email);addDetail(items,'Endereço',p?.endereco);addDetail(items,'Contato de emergência',p?.contato_emergencia);addDetail(items,'Responsável legal',p?.responsavel_legal);addDetail(items,'Observações cadastrais',p?.observacoes_cadastrais);
    addDetail(items,'Unidade',u?.nome);addDetail(items,'Tipo da unidade',u?.tipo);addDetail(items,'Endereço da unidade',u?.endereco);addDetail(items,'Cidade / UF',[u?.cidade,u?.estado].filter(Boolean).join(' / '));addDetail(items,'Chegada',a?.inicio_em?fmtDateTime(a.inicio_em):null);addDetail(items,'Última atualização do atendimento',a?.atualizado_em?fmtDateTime(a.atualizado_em):null);addDetail(items,'Tipo de atendimento',a?.tipo_atendimento);addDetail(items,'Origem do registro',a?.origem);addDetail(items,'Status do atendimento',a?.status?titleCase(a.status):null);addDetail(items,'Etapa atual',info.stage);addDetail(items,'Setor',f?.setor);addDetail(items,'Sala',f?.sala);addDetail(items,'Status da fila',f?.status?titleCase(f.status):null);addDetail(items,'Entrada na fila',f?.entrou_em?fmtDateTime(f.entrou_em):null);addDetail(items,'Chamado em',f?.chamado_em?fmtDateTime(f.chamado_em):null);addDetail(items,'Atendimento profissional iniciado em',f?.atendimento_iniciado_em?fmtDateTime(f.atendimento_iniciado_em):null);addDetail(items,'Atendimento finalizado em',f?.atendimento_finalizado_em?fmtDateTime(f.atendimento_finalizado_em):null);if(state.summary?.posicao_fila>0)addDetail(items,'Posição calculada na fila',`${state.summary.posicao_fila}º`);if(state.summary?.tempo_estimado_minutos!=null)addDetail(items,'Estimativa dinâmica de espera',`${state.summary.tempo_estimado_minutos} min`);addDetail(items,'Fonte da estimativa',sourceName(state.summary?.estimativa_fonte));addDetail(items,'Motivo da reavaliação',state.summary?.motivo_reavaliacao);
    if(sinais?.[0]?.glicemia_estimada!=null)addDetail(items,sinais[0].glicemia_experimental?'Glicemia estimada (experimental)':'Glicemia',`${sinais[0].glicemia_estimada} mg/dL`);addDetail(items,'Qualidade da última aferição',sinais?.[0]?.qualidade);addDetail(items,'Observações da última aferição',sinais?.[0]?.observacoes);
    const cls=state.raw.classificacoes?.[0];if(cls){addDetail(items,cls.preliminar===false?'Classificação atual':'Classificação preliminar',colorName(cls.cor));if(cls.requer_reavaliacao)addDetail(items,'Reavaliação indicada pelo sistema','Sim');addDetail(items,'Observação sobre a classificação',cls.observacao||cls.justificativa||null);}
    (solicitacoesReavaliacao||[]).forEach((r,i)=>addDetail(items,`Solicitação de reavaliação ${i+1}`,`${titleCase(r.status)} · ${r.motivo}${r.criado_em?` · ${fmtDateTime(r.criado_em)}`:''}`));
    (reavaliacoes||[]).forEach((r,i)=>addDetail(items,`Reavaliação ${i+1} · ${fmtDateTime(r.criado_em)}`,`${colorName(r.cor_anterior)} → ${colorName(r.cor_nova)}${r.motivo?` · ${r.motivo}`:''}${r.observacoes?` · ${r.observacoes}`:''}${r.sinais&&Object.keys(r.sinais).length?` · Sinais: ${formatValue(r.sinais)}`:''}`));
    (diagnosticos||[]).forEach((d,i)=>addDetail(items,`Diagnóstico ${i+1}`,`${d.codigo?`${d.codigo} · `:''}${d.descricao}${d.tipo?` · ${titleCase(d.tipo)}`:''}${d.observacoes?` · ${d.observacoes}`:''}`));
    (prescricoes||[]).forEach((x,i)=>addDetail(items,`Prescrição ${i+1}`,[x.medicamento,x.concentracao,x.forma_farmaceutica,x.dose,x.via,x.frequencia,x.duracao,x.orientacoes,x.status?`Status: ${titleCase(x.status)}`:null].filter(Boolean).join(' · ')));
    (exames||[]).forEach((x,i)=>addDetail(items,`Exame ${i+1}`,[x.exame,x.categoria,`Status: ${titleCase(x.status)}`,x.prioridade?`Prioridade: ${titleCase(x.prioridade)}`:null,x.preparo,x.unidade_execucao,x.data_agendamento?`Agendado: ${fmtDateTime(x.data_agendamento)}`:null,x.data_realizacao?`Realizado: ${fmtDateTime(x.data_realizacao)}`:null,x.resultado_resumo,x.laudo].filter(Boolean).join(' · ')));
    (encaminhamentos||[]).forEach((x,i)=>addDetail(items,`Encaminhamento ${i+1}`,[x.especialidade,`Status: ${titleCase(x.status)}`,x.prioridade?`Prioridade: ${titleCase(x.prioridade)}`:null,x.motivo,x.hipotese_diagnostica,x.unidade_destino,x.profissional,x.data_agendamento?fmtDateTime(x.data_agendamento):null,x.observacoes].filter(Boolean).join(' · ')));
    (procedimentos||[]).forEach((x,i)=>addDetail(items,`Procedimento ${i+1}`,[x.procedimento,x.codigo,`Status: ${titleCase(x.status)}`,x.resultado,x.observacoes,x.realizado_em?fmtDateTime(x.realizado_em):null].filter(Boolean).join(' · ')));
    (evolucoes||[]).forEach((x,i)=>addDetail(items,`Evolução clínica ${i+1} · ${fmtDateTime(x.criado_em)}`,[x.tipo?`Tipo: ${titleCase(x.tipo)}`:null,x.subjetivo,x.objetivo,x.avaliacao,x.plano,x.texto_livre].filter(Boolean).join(' · ')));
    (consentimentos||[]).forEach((x,i)=>addDetail(items,`Consentimento ${i+1}`,`${titleCase(x.tipo)} · ${x.aceito?'Aceito':'Não aceito'}${x.metodo?` · ${titleCase(x.metodo)}`:''} · ${fmtDateTime(x.registrado_em)}`));
    (anexos||[]).forEach((x,i)=>addDetail(items,`Documento / anexo ${i+1}`,[x.nome_arquivo,x.descricao,x.mime_type,x.tamanho_bytes!=null?`${x.tamanho_bytes} bytes`:null,fmtDateTime(x.criado_em)].filter(Boolean).join(' · ')));
    return items;
  }

  function renderDetails(target,items){const el=$(target);if(el)el.innerHTML=items.map(item=>`<div class="detail-row"><dt>${escapeHTML(item.label)}</dt><dd>${escapeHTML(item.value)}</dd></div>`).join('');}

  function buildJourney(){const {atendimento:a,triagem:t,sinais,classificacoes,reavaliacoes,exames,encaminhamentos,prescricoes,procedimentos}=state.raw;const info=stageInfo();const currentFinished=info.progress===100;const latestVital=sinais?.[0];const arr=[{title:'Chegada à unidade',description:'Entrada registrada no atendimento.',time:fmtTime(a?.inicio_em),state:'done'},{title:'Cadastro',description:'Identificação e dados iniciais vinculados ao prontuário.',time:fmtTime(a?.criado_em),state:'done'},{title:'Anamnese',description:t?'Sintomas e informações de saúde registrados.':'Aguardando registro da anamnese.',time:t?fmtTime(t.criado_em):'—',state:t?'done':'upcoming'},{title:'Sinais vitais',description:latestVital?'Aferições registradas no prontuário.':'Aguardando aferições.',time:latestVital?fmtTime(latestVital.medido_em):'—',state:latestVital?'done':'upcoming'}];if(reavaliacoes?.length)arr.push({title:'Reavaliação',description:'Uma reavaliação profissional foi registrada.',time:fmtTime(reavaliacoes[0].criado_em),state:'done'});arr.push({title:info.stage,description:currentFinished?'Esta etapa foi concluída.':'Você está nesta etapa agora.',time:currentFinished?fmtTime(a?.finalizado_em):'Agora',state:currentFinished?'done':'current'});const clinicalCount=(exames?.length||0)+(encaminhamentos?.length||0)+(prescricoes?.length||0)+(procedimentos?.length||0);if(clinicalCount)arr.push({title:'Condutas registradas',description:`${clinicalCount} ${clinicalCount===1?'registro clínico disponibilizado':'registros clínicos disponibilizados'}.`,time:'Atualizado',state:currentFinished?'done':'upcoming'});else if(!currentFinished)arr.push({title:'Conduta e próximos passos',description:'Aparecerá aqui quando houver atualização.',time:'—',state:'upcoming'});return arr;}
  function renderJourney(){const el=$('#journeyList');if(el)el.innerHTML=buildJourney().map(item=>{const icon=item.state==='done'?'✓':item.state==='current'?'●':'○';return`<li class="journey-item ${escapeHTML(item.state)}"><span class="journey-marker" aria-hidden="true">${icon}</span><div class="journey-copy"><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.description)}</p></div><span class="journey-time">${escapeHTML(item.time)}</span></li>`;}).join('');}

  function clinicalRows(){
    const r=state.raw;
    return [
      {key:'reavaliacoes',title:'Reavaliações',icon:'↻',items:r.reavaliacoes||[],date:x=>x.criado_em,head:x=>`${colorName(x.cor_anterior)} → ${colorName(x.cor_nova)}`,text:x=>[x.motivo,x.observacoes,x.sinais&&Object.keys(x.sinais).length?`Sinais: ${formatValue(x.sinais)}`:null].filter(Boolean).join(' · ')},
      {key:'diagnosticos',title:'Diagnósticos e hipóteses',icon:'✦',items:r.diagnosticos||[],date:x=>x.criado_em,head:x=>`${x.codigo?`${x.codigo} · `:''}${x.descricao||'Registro diagnóstico'}`,text:x=>[x.tipo?titleCase(x.tipo):null,x.principal?'Principal':null,x.observacoes].filter(Boolean).join(' · ')},
      {key:'prescricoes',title:'Prescrições',icon:'Rx',items:r.prescricoes||[],date:x=>x.criado_em,head:x=>x.medicamento||'Prescrição',text:x=>[x.concentracao,x.forma_farmaceutica,x.dose,x.via,x.frequencia,x.duracao,x.orientacoes,x.status?`Status: ${titleCase(x.status)}`:null].filter(Boolean).join(' · ')},
      {key:'exames',title:'Exames',icon:'⌁',items:r.exames||[],date:x=>x.data_solicitacao||x.criado_em,head:x=>x.exame||'Exame',text:x=>[x.categoria,x.status?`Status: ${titleCase(x.status)}`:null,x.prioridade?`Prioridade: ${titleCase(x.prioridade)}`:null,x.data_agendamento?`Agendado: ${fmtDateTime(x.data_agendamento)}`:null,x.resultado_resumo,x.laudo].filter(Boolean).join(' · ')},
      {key:'encaminhamentos',title:'Encaminhamentos',icon:'→',items:r.encaminhamentos||[],date:x=>x.data_solicitacao||x.criado_em,head:x=>x.especialidade||'Encaminhamento',text:x=>[x.status?`Status: ${titleCase(x.status)}`:null,x.motivo,x.unidade_destino,x.data_agendamento?`Agendado: ${fmtDateTime(x.data_agendamento)}`:null,x.observacoes].filter(Boolean).join(' · ')},
      {key:'procedimentos',title:'Procedimentos',icon:'+',items:r.procedimentos||[],date:x=>x.realizado_em||x.criado_em,head:x=>x.procedimento||'Procedimento',text:x=>[x.codigo,x.status?`Status: ${titleCase(x.status)}`:null,x.resultado,x.observacoes].filter(Boolean).join(' · ')},
      {key:'evolucoes',title:'Evoluções clínicas',icon:'▤',items:r.evolucoes||[],date:x=>x.criado_em,head:x=>x.tipo?`Evolução · ${titleCase(x.tipo)}`:'Evolução clínica',text:x=>[x.subjetivo,x.objetivo,x.avaliacao,x.plano,x.texto_livre].filter(Boolean).join(' · ')},
      {key:'consentimentos',title:'Consentimentos',icon:'✓',items:r.consentimentos||[],date:x=>x.registrado_em,head:x=>titleCase(x.tipo||'Consentimento'),text:x=>`${x.aceito?'Aceito':'Não aceito'}${x.metodo?` · ${titleCase(x.metodo)}`:''}${x.versao_documento?` · Versão ${x.versao_documento}`:''}`},
      {key:'anexos',title:'Documentos e anexos',icon:'▣',items:r.anexos||[],date:x=>x.criado_em,head:x=>x.nome_arquivo||'Documento',text:x=>[x.descricao,x.mime_type,x.tamanho_bytes!=null?`${x.tamanho_bytes} bytes`:null].filter(Boolean).join(' · ')}
    ];
  }
  function renderClinicalHub(){
    const groups=clinicalRows();const total=groups.reduce((n,g)=>n+g.items.length,0);safeText('#clinicalTotal',compactCount(total,'registro','registros'));
    const metrics=[{label:'Reavaliações',n:state.raw.reavaliacoes?.length||0},{label:'Exames',n:state.raw.exames?.length||0},{label:'Prescrições',n:state.raw.prescricoes?.length||0},{label:'Encaminhamentos',n:state.raw.encaminhamentos?.length||0}];
    $('#clinicalMetrics').innerHTML=metrics.map(m=>`<div class="clinical-metric"><span>${escapeHTML(m.label)}</span><strong>${m.n}</strong></div>`).join('');
    $('#clinicalGroups').innerHTML=groups.map((g,idx)=>`<details class="clinical-group" ${g.items.length&&idx<2?'open':''}><summary><span class="clinical-group-icon" aria-hidden="true">${escapeHTML(g.icon)}</span><span class="clinical-group-title"><strong>${escapeHTML(g.title)}</strong><small>${escapeHTML(compactCount(g.items.length,'registro','registros'))}</small></span></summary><div class="clinical-items">${g.items.length?g.items.map(x=>`<article class="clinical-item"><div class="clinical-item-head"><strong>${escapeHTML(g.head(x)||g.title)}</strong><time>${escapeHTML(fmtDateTime(g.date(x)))}</time></div><p>${escapeHTML(g.text(x)||'Sem detalhes adicionais.')}</p></article>`).join(''):'<div class="empty-clinical">Nenhum registro nesta categoria até o momento.</div>'}</div></details>`).join('');
  }

  function buildUpdates(){const {eventos,reavaliacoes,classificacoes,sinais,triagem,atendimento,solicitacoesReavaliacao,exames,encaminhamentos}=state.raw;const updates=[];(eventos||[]).forEach(e=>updates.push({time:e.criado_em,title:e.titulo||titleCase(e.tipo),text:e.descricao||'',type:/CONCL|FINAL|REGISTR|ATEND/i.test(e.tipo)?'success':'info'}));(solicitacoesReavaliacao||[]).slice(0,5).forEach(r=>updates.push({time:r.criado_em,title:'Reavaliação solicitada',text:String(r.status||'').toUpperCase()==='ATENDIDA'?'Sua solicitação de reavaliação foi atendida.':'Sua solicitação foi enviada para a equipe.',type:String(r.status||'').toUpperCase()==='ATENDIDA'?'success':'info'}));if(!updates.length){if(classificacoes?.[0])updates.push({time:classificacoes[0].criado_em,title:'Pré-atendimento concluído',text:'Sua prioridade foi registrada e disponibilizada para a equipe.',type:'success'});if(sinais?.[0])updates.push({time:sinais[0].medido_em,title:'Sinais vitais registrados',text:'As últimas aferições já estão disponíveis no portal.',type:'success'});if(triagem)updates.push({time:triagem.criado_em,title:'Anamnese concluída',text:'As informações que você respondeu foram salvas.',type:'success'});if(atendimento)updates.push({time:atendimento.inicio_em,title:'Atendimento iniciado',text:'Sua entrada na unidade foi registrada.',type:'success'});}if(exames?.[0])updates.push({time:exames[0].atualizado_em||exames[0].data_solicitacao,title:'Exame atualizado',text:`${exames[0].exame} · ${titleCase(exames[0].status)}`,type:'info'});if(encaminhamentos?.[0])updates.push({time:encaminhamentos[0].atualizado_em||encaminhamentos[0].data_solicitacao,title:'Encaminhamento atualizado',text:`${encaminhamentos[0].especialidade} · ${titleCase(encaminhamentos[0].status)}`,type:'info'});const seen=new Set();return updates.sort((a,b)=>new Date(b.time||0)-new Date(a.time||0)).filter(x=>{const k=`${x.title}|${x.time}`;if(seen.has(k))return false;seen.add(k);return true;}).slice(0,16);}
  function renderUpdates(){const updates=buildUpdates();$('#updatesList').innerHTML=updates.map(u=>`<article class="update-card"><span class="update-dot" aria-hidden="true">${u.type==='success'?'✓':'i'}</span><div><strong>${escapeHTML(u.title)}</strong><p>${escapeHTML(u.text)}</p><span class="update-time">${escapeHTML(fmtDateTime(u.time))}</span></div></article>`).join('');const newest=updates[0];const key=newest?`${newest.title}|${newest.time}`:null;if(state.previousUpdateKey&&key&&state.previousUpdateKey!==key){announce(`Há uma nova atualização no seu atendimento: ${newest.title}.`);}state.previousUpdateKey=key;}

  function statusSpeech(){const p=state.raw.paciente;const info=stageInfo();const wait=state.summary.tempo_estimado_minutos;const pos=state.summary.posicao_fila;const priority=state.raw.classificacoes?.[0]?.cor;return`${greeting()}, ${p?.nome_social||p?.nome||'paciente'}. Sua etapa atual é ${info.stage}. ${wait!=null?`A estimativa de espera é de aproximadamente ${wait} minutos.`:''} ${pos>0?`Sua posição estimada na fila é ${pos}.`:''} Sua prioridade registrada é ${colorName(priority)}.`;}
  function guidanceSpeech(){const name=state.raw.paciente?.nome_social||state.raw.paciente?.nome||'Paciente';return`${name}, permaneça próximo à área de espera e acompanhe as atualizações neste portal. Se seus sintomas piorarem, procure a equipe da unidade imediatamente.`;}
  function pageSummarySpeech(){const v=state.raw.sinais?.[0]||{};return`${statusSpeech()} Últimos sinais vitais: pressão ${v.pressao_sistolica??'não informada'} por ${v.pressao_diastolica??'não informada'}, frequência cardíaca ${v.bpm??'não informada'}, saturação ${v.spo2??'não informada'} por cento e temperatura ${v.temperatura??'não informada'} graus Celsius.`;}
  function speak(text){if(!('speechSynthesis'in window)){toast('A leitura em voz alta não está disponível neste navegador.');return;}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='pt-BR';u.rate=.96;speechSynthesis.speak(u);}

  function pendingReassessment(){if(state.summary?.reavaliacao_solicitada)return true;return(state.raw.solicitacoesReavaliacao||[]).some(x=>['PENDENTE','EM_ANALISE'].includes(String(x.status||'').toUpperCase()));}
  function updateReassessmentButton(){const btn=$('#requestReassessment');const a=state.raw.atendimento;const fila=state.raw.fila;if(!btn)return;if(pendingReassessment()){btn.disabled=true;btn.textContent='✓ Reavaliação solicitada';return;}const allowed=['aguardando','chamado'].includes(a?.status)&&!['finalizado','cancelado','em_atendimento'].includes(fila?.status);btn.disabled=!allowed;btn.textContent=allowed?'↻ Solicitar reavaliação médica':'Reavaliação indisponível nesta etapa';}
  async function submitReassessment(event){event.preventDefault();const reason=$('#reassessmentReason').value.trim();if(reason.length<5){toast('Descreva brevemente o que mudou para enviar a solicitação.');return;}const btn=$('#sendReassessment');btn.disabled=true;btn.textContent='Enviando...';try{const{data,error}=await client.rpc('paciente_solicitar_reavaliacao',{p_atendimento_id:state.attendanceId,p_motivo:reason});if(error)throw error;if(!data?.ok)throw new Error(data?.mensagem||'Não foi possível solicitar a reavaliação.');$('#reassessmentDialog').close();$('#reassessmentReason').value='';updateReasonCount();toast(data.mensagem||'Reavaliação solicitada.');announce('Sua solicitação de reavaliação foi enviada para a equipe.');await refreshData(false);}catch(e){toast(e?.message||'Não foi possível solicitar a reavaliação.');}finally{btn.disabled=false;btn.textContent='Enviar solicitação';}}

  function togglePrivacy(force){const on=typeof force==='boolean'?force:!document.body.classList.contains('privacy-mode');document.body.classList.toggle('privacy-mode',on);['#privacyToggle'].forEach(s=>$(s)?.setAttribute('aria-pressed',String(on)));safeText('#privacyToggle',on?'◎':'◉');safeText('#privacyToggleSide',on?'Mostrar dados na tela':'Ocultar dados na tela');sessionStorage.setItem('vc-privacy',on?'1':'0');toast(on?'Modo de privacidade ativado.':'Dados visíveis novamente.');}
  function updateReasonCount(){const v=$('#reassessmentReason')?.value||'';safeText('#reasonCount',`${v.length}/600`);}
  function copyRecord(){const value=state.raw.paciente?.numero_prontuario;if(!value){toast('Número de prontuário ainda não disponível.');return;}navigator.clipboard?.writeText(String(value)).then(()=>toast('Número do prontuário copiado.')).catch(()=>toast(`Prontuário: ${value}`));}

  function bindControls(){
    $('#listenStatus')?.addEventListener('click',()=>speak(statusSpeech()));$('#listenGuidance')?.addEventListener('click',()=>speak(guidanceSpeech()));$('#readPage')?.addEventListener('click',()=>speak(pageSummarySpeech()));$('#refreshStatus')?.addEventListener('click',()=>refreshData(true));$('#profileButton')?.addEventListener('click',()=>logout(true));
    $('#requestReassessment')?.addEventListener('click',()=>{if(!$('#requestReassessment').disabled)$('#reassessmentDialog').showModal();});$('#closeReassessment')?.addEventListener('click',()=>$('#reassessmentDialog').close());$('#cancelReassessment')?.addEventListener('click',()=>$('#reassessmentDialog').close());$('#reassessmentForm')?.addEventListener('submit',submitReassessment);$('#reassessmentReason')?.addEventListener('input',updateReasonCount);
    $$('.quick-reasons button').forEach(btn=>btn.addEventListener('click',()=>{const ta=$('#reassessmentReason');const reason=btn.dataset.reason||'';ta.value=ta.value.trim()?`${ta.value.trim()} ${reason}`:reason;ta.focus();updateReasonCount();}));
    $('#contrastToggle')?.addEventListener('click',(e)=>{const on=document.body.classList.toggle('high-contrast');e.currentTarget.setAttribute('aria-pressed',String(on));localStorage.setItem('vc-contrast',on?'1':'0');toast(on?'Alto contraste ativado.':'Alto contraste desativado.');});
    $('#fontToggle')?.addEventListener('click',()=>{const enlarged=document.documentElement.style.getPropertyValue('--font-scale')==='1.08';document.documentElement.style.setProperty('--font-scale',enlarged?'1':'1.08');localStorage.setItem('vc-font',enlarged?'0':'1');toast(enlarged?'Tamanho do texto restaurado.':'Texto aumentado.');});
    $('#motionToggle')?.addEventListener('click',()=>{const on=document.body.classList.toggle('reduced-motion');localStorage.setItem('vc-motion',on?'1':'0');toast(on?'Animações reduzidas.':'Animações restauradas.');});
    $('#privacyToggle')?.addEventListener('click',()=>togglePrivacy());$('#privacyToggleSide')?.addEventListener('click',()=>togglePrivacy());$('#copyRecordNumber')?.addEventListener('click',copyRecord);$('#printSummary')?.addEventListener('click',()=>window.print());
    const navLinks=[...$$('.bottom-nav a')];const sections=['conteudo','jornada','dados','prontuario','ajuda'].map(id=>document.getElementById(id)).filter(Boolean);const observer=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(!visible)return;navLinks.forEach(a=>a.classList.toggle('active',a.getAttribute('href')===`#${visible.target.id}`));},{rootMargin:'-28% 0px -62% 0px',threshold:[0,.2,.6]});sections.forEach(s=>observer.observe(s));
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.installPrompt=e;const b=$('#installApp');if(b)b.hidden=false;});$('#installApp')?.addEventListener('click',async()=>{if(!state.installPrompt)return;state.installPrompt.prompt();await state.installPrompt.userChoice.catch(()=>{});state.installPrompt=null;$('#installApp').hidden=true;});
  }

  function restorePreferences(){if(localStorage.getItem('vc-contrast')==='1')document.body.classList.add('high-contrast');if(localStorage.getItem('vc-font')==='1')document.documentElement.style.setProperty('--font-scale','1.08');if(localStorage.getItem('vc-motion')==='1')document.body.classList.add('reduced-motion');if(sessionStorage.getItem('vc-privacy')==='1')togglePrivacy(true);}
  function renderAll(){renderBasics();renderJourney();renderVitals();renderClinicalHub();renderDetails('#anamnesisList',buildAnamnesis());renderDetails('#attendanceInfo',buildAttendanceInfo());renderUpdates();}

  function updateConnectionState(){const el=$('#connectionState');if(!el)return;const online=navigator.onLine;let label='Offline';let cls='offline';if(online&&state.realtimeStatus==='SUBSCRIBED'){label='Conectado ao vivo';cls='online';}else if(online){label='Conectado';cls='reconnecting';}el.className=`connection-state ${cls}`;el.innerHTML=`<i></i><strong>${escapeHTML(label)}</strong>`;}
  function updateClock(){safeText('#brasiliaClock',`Horário de Brasília · ${clockFmt.format(new Date())}`);if(state.nextRefreshAt){const sec=Math.max(0,Math.ceil((state.nextRefreshAt-Date.now())/1000));safeText('#refreshCountdown',sec>0?`Verificação em ${sec}s`:'Atualizando…');}}
  function updateFreshness(){if(!state.lastFetchAt)return;const sec=Math.max(0,Math.round((Date.now()-state.lastFetchAt.getTime())/1000));safeText('#dataFreshness',sec<10?'Dados sincronizados agora':sec<60?`Dados sincronizados há ${sec}s`:`Dados sincronizados há ${Math.floor(sec/60)} min`);}

  async function refreshData(showToast=false){if(state.refreshPromise)return state.refreshPromise;state.refreshPromise=(async()=>{setBusy(true);try{await fetchAll();renderAll();updateConnectionState();if(showToast)toast('Informações atualizadas com o banco do VitalCare.');}catch(e){if(/expirou|sessão/i.test(e?.message||'')){toast('Sua sessão expirou. Entre novamente.');setTimeout(()=>logout(false),900);}else{toast(e?.message||'Não foi possível atualizar agora. Tentaremos novamente.');}}finally{setBusy(false);state.refreshPromise=null;}})();return state.refreshPromise;}

  let realtimeTimer;
  function scheduleRealtimeRefresh(){clearTimeout(realtimeTimer);realtimeTimer=setTimeout(()=>refreshData(false),cfg.realtimeDebounceMs||350);}
  function subscribeRealtime(){
    if(state.channel)client.removeChannel(state.channel).catch(()=>{});const id=state.attendanceId;let ch=client.channel(`minha-fila-v5-${id}`);
    const attendanceTables=['respostas_triagem','sinais_vitais','classificacoes','fila_atendimento','reavaliacoes','eventos_atendimento','solicitacoes_exames','encaminhamentos','prescricoes','procedimentos','diagnosticos','evolucoes_clinicas','consentimentos','anexos_prontuario','solicitacoes_reavaliacao_paciente'];
    ch=ch.on('postgres_changes',{event:'*',schema:'public',table:'atendimentos',filter:`id=eq.${id}`},scheduleRealtimeRefresh);
    attendanceTables.forEach(table=>{ch=ch.on('postgres_changes',{event:'*',schema:'public',table,filter:`atendimento_id=eq.${id}`},scheduleRealtimeRefresh);});
    state.channel=ch.subscribe(status=>{state.realtimeStatus=status;updateConnectionState();if(status==='SUBSCRIBED')announce('Atualizações em tempo real conectadas.');});
  }

  function registerSW(){if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js?v=5.2.1').catch(()=>{});}

  async function init(){
    restorePreferences();bindControls();registerSW();updateReasonCount();updateConnectionState();updateClock();setInterval(()=>{updateClock();updateFreshness();},1000);
    if(!(await ensureSession()))return;await refreshData(false);subscribeRealtime();
    setInterval(()=>{if(!document.hidden)refreshData(false);},cfg.refreshIntervalMs||20000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshData(false);});window.addEventListener('focus',()=>refreshData(false));window.addEventListener('online',()=>{updateConnectionState();refreshData(true);});window.addEventListener('offline',()=>{updateConnectionState();toast('Você está sem internet. Os dados exibidos podem ficar temporariamente desatualizados.');});
  }
  init();
})();
