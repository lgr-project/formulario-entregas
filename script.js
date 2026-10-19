"use strict";

const formulario = document.getElementById("entrega-form");
const resultado = document.getElementById("resultado");
const botaoCopiar = document.getElementById("copiar");
const textoCopiar = document.getElementById("copy-label");
const statusFormulario = document.getElementById("form-status");
const statusCopia = document.getElementById("copy-status");
const campoValor = document.getElementById("valor");
const campoTaxa = document.getElementById("taxa");
let versaoResultado = 0;
const formatoReais = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

// Aceita 345, 345,50, 345.50 e 1.234,56. Calcula em centavos.
function lerCentavos(texto) {
  let valor = texto.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");

  if (valor.includes(",")) {
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(valor)) return null;
    valor = valor.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(valor)) {
    valor = valor.replace(/\./g, "");
  } else if (!/^\d+(?:\.\d{1,2})?$/.test(valor)) {
    return null;
  }

  const [inteiro, decimal = ""] = valor.split(".");
  const centavos = Number(inteiro) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(centavos) && centavos >= 0 ? centavos : null;
}

function limparTexto(texto) {
  return texto.trim().replace(/\s+/g, " ");
}

function montarMensagem(dados, centavos, taxaCentavos = null) {
  const entrega = dados.entrega.replace(/^0+(?=\d)/, "").padStart(2, "0");
  const linhas = [
    `*${entrega}* - *${dados.cliente}*`,
    dados.endereco
  ];

  // O travessão é adicionado aqui; não é necessário digitá-lo no campo.
  const complemento = dados.complemento.replace(/^[—–-]\s*/, "").trim();
  if (complemento) linhas.push(`— ${complemento}`);
  linhas.push(`*R$${formatoReais.format(centavos / 100)}* - *${dados.pagamento}*`);
  linhas.push("", `> Produto: ${dados.produtos}`);
  if (taxaCentavos !== null) {
    linhas.push("", `#Taxa R$${formatoReais.format(taxaCentavos / 100)}`);
  }
  return linhas.join("\n");
}

function avisar(elemento, mensagem, alerta = false) {
  elemento.textContent = mensagem;
  elemento.classList.toggle("warning", alerta);
}

// Limpa o erro ao editar e mantém o resultado até o próximo Enviar.
formulario.addEventListener("input", (evento) => {
  if (evento.target !== campoValor && evento.target !== campoTaxa && typeof evento.target.setCustomValidity === "function") {
    evento.target.setCustomValidity("");
  }
  if (resultado.value) {
    avisar(statusFormulario, "Dados alterados. Clique em Enviar para atualizar.", true);
    avisar(statusCopia, "");
    textoCopiar.textContent = "Copiar";
  }
});

// Máscara em centavos: ao digitar 34500, o campo mostra 345,00.
// Também aceita colar valores já formatados, como R$ 1.234,56.
[campoValor, campoTaxa].forEach((campo) => {
  campo.addEventListener("input", (evento) => {
    campo.setCustomValidity("");
    const digitos = campo.value.replace(/\D/g, "");
    const centavos = Number(digitos);

    if (!digitos || (centavos === 0 && evento.inputType?.startsWith("delete"))) {
      campo.value = "";
      return;
    }
    if (!Number.isSafeInteger(centavos)) {
      campo.setCustomValidity("O valor informado é muito alto. Digite um valor menor.");
      return;
    }
    campo.value = formatoReais.format(centavos / 100);
  });

  campo.addEventListener("blur", () => {
    const centavos = lerCentavos(campo.value);
    if (centavos !== null) campo.value = formatoReais.format(centavos / 100);
  });
});

formulario.addEventListener("submit", (evento) => {
  evento.preventDefault();
  const dados = Object.fromEntries(new FormData(formulario));
  Object.keys(dados).forEach((chave) => { dados[chave] = limparTexto(dados[chave]); });

  for (const nome of ["cliente", "endereco"]) {
    if (!dados[nome]) {
      const campo = formulario.elements.namedItem(nome);
      campo.setCustomValidity("Preencha este campo.");
      campo.reportValidity();
      return;
    }
  }

  const centavos = lerCentavos(dados.valor);
  if (centavos === null) {
    campoValor.setCustomValidity("Informe um valor válido em reais, como 345,00.");
    campoValor.reportValidity();
    return;
  }

  const taxaCentavos = dados.taxa ? lerCentavos(dados.taxa) : null;
  if (dados.taxa && taxaCentavos === null) {
    campoTaxa.setCustomValidity("Informe uma taxa válida em reais, como 10,00.");
    campoTaxa.reportValidity();
    return;
  }

  campoValor.value = formatoReais.format(centavos / 100);
  if (taxaCentavos !== null) campoTaxa.value = formatoReais.format(taxaCentavos / 100);
  resultado.value = montarMensagem(dados, centavos, taxaCentavos);
  versaoResultado += 1;
  botaoCopiar.disabled = false;
  textoCopiar.textContent = "Copiar";
  avisar(statusFormulario, "Resultado atualizado. Pronto para copiar.");
  avisar(statusCopia, "");
});

formulario.addEventListener("reset", () => {
  for (const campo of formulario.elements) {
    if (typeof campo.setCustomValidity === "function") campo.setCustomValidity("");
  }
  versaoResultado += 1;
  resultado.value = "";
  botaoCopiar.disabled = true;
  textoCopiar.textContent = "Copiar";
  avisar(statusFormulario, "");
  avisar(statusCopia, "");
  formulario.elements.namedItem("entrega").focus();
});

// A alternativa com seleção também atende navegadores que restringem
// a Clipboard API quando o HTML é aberto diretamente no computador.
function copiarPorSelecao() {
  resultado.focus();
  resultado.select();
  resultado.setSelectionRange(0, resultado.value.length);
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  }
}

botaoCopiar.addEventListener("click", async () => {
  if (!resultado.value) return;
  const versaoCopiada = versaoResultado;
  let copiado = false;
  botaoCopiar.disabled = true;

  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(resultado.value);
      copiado = true;
    }
  } catch {
    // Tenta a seleção abaixo se o navegador negar a cópia moderna.
  }

  // Não restaura mensagens antigas se a lixeira for usada durante a cópia.
  if (versaoCopiada !== versaoResultado) return;
  if (!copiado) copiado = copiarPorSelecao();
  botaoCopiar.disabled = false;

  if (copiado) {
    textoCopiar.textContent = "Copiado!";
    avisar(statusCopia, "Agora é só colar no WhatsApp.");
    botaoCopiar.focus();
  } else {
    avisar(statusCopia, "Texto selecionado. Use Ctrl+C, ⌘C ou a opção Copiar do celular.", true);
  }
});
