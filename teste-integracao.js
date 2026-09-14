(() => {
  const cfg=window.VITALCARE_CONFIG, out=document.getElementById('result'), log=document.getElementById('log');
  const add=(ok,title,msg)=>{const d=document.createElement('div');d.className=`test ${ok?'ok':'bad'}`;d.textContent=`${ok?'✓':'✕'} ${title} — ${msg}`;out.appendChild(d);log.textContent+=`${ok?'PASS':'FAIL'} | ${title} | ${msg}\n`;};
  const client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storage:sessionStorage}});
  document.getElementById('testForm').addEventListener('submit',async e=>{e.preventDefault();out.innerHTML='';log.textContent='';const btn=document.getElementById('run');btn.disabled=true;try{
    await client.auth.signOut({scope:'local'}).catch(()=>{});
    let r=await client.auth.signInAnonymously();if(r.error)throw r.error;add(true,'Autenticação anônima','sessão criada');
    const cpf=document.getElementById('cpf').value.replace(/\D/g,''),birth=document.getElementById('birth').value;
    r=await client.rpc('entrar_minha_fila',{p_cpf:cpf,p_data_nascimento:birth});if(r.error)throw r.error;if(!r.data?.ok)throw new Error(r.data?.mensagem||'login recusado');const id=r.data.atendimento_id;add(true,'Login do paciente',`atendimento ${String(id).slice(0,8)}…`);
    r=await client.rpc('minha_fila_resumo',{p_atendimento_id:id});if(r.error)throw r.error;add(Boolean(r.data?.ok),'Fila dinâmica',r.data?.ok?`posição ${r.data.posicao_fila??'—'} · espera ${r.data.tempo_estimado_minutos??'—'} min`:JSON.stringify(r.data));
    for(const [t,label] of [['pacientes','Paciente'],['atendimentos','Atendimento'],['respostas_triagem','Anamnese'],['sinais_vitais','Sinais vitais'],['classificacoes','Classificação'],['fila_atendimento','Fila'],['reavaliacoes','Reavaliações'],['eventos_atendimento','Eventos'],['solicitacoes_reavaliacao_paciente','Solicitações de reavaliação']]){const q=await client.from(t).select('*');if(q.error)add(false,label,q.error.message);else add(true,label,`${q.data.length} registro(s) visível(is)`);}
    add(true,'Teste concluído','nenhuma solicitação de reavaliação foi criada');
  }catch(err){add(false,'Erro geral',err.message||String(err));}finally{btn.disabled=false;}});
})();
