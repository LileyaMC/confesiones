const URL_SCRIPT = 'https://script.google.com/macros/s/AKfycbwbq0AvLedkSaZ6bEaT_xsIiPtDH8Hx7DfRg9q9RM9IDWM69bmf-MzVCc-uqUYLXt5Twg/exec';
const INTERVALO_ACTUALIZACION = 5000;
const CLAVE_ALMACENAMIENTO = 'confesiones_leidas_ids';

const contenedorLista = document.getElementById('lista-confesiones');
let marcasTiempoRenderizadas = new Set();

// Obtener identificador único y persistente para cada confesión
function obtenerIdConfesion(elemento) {
    if (elemento.rowIndex !== undefined && elemento.rowIndex !== null) {
        return 'fila_' + elemento.rowIndex;
    }
    if (elemento.timestamp) {
        return 'tiempo_' + elemento.timestamp;
    }
    return 'texto_' + encodeURIComponent(elemento.confesion || '').slice(0, 50);
}

// Obtener el conjunto de IDs leídos guardados en localStorage
function obtenerConjuntoLeidos() {
    try {
        const almacenado = localStorage.getItem(CLAVE_ALMACENAMIENTO);
        return almacenado ? new Set(JSON.parse(almacenado)) : new Set();
    } catch (error) {
        console.error('Error al leer de localStorage:', error);
        return new Set();
    }
}

// Guardar permanentemente en localStorage
function guardarConjuntoLeidos(conjunto) {
    try {
        localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(Array.from(conjunto)));
    } catch (error) {
        console.error('Error al guardar en localStorage:', error);
    }
}

// Alternar leído / no leído al hacer clic
window.alternarLeido = function (id, evento) {
    if (evento) evento.stopPropagation();

    const conjuntoLeidos = obtenerConjuntoLeidos();
    const tarjeta = document.querySelector(`.tarjeta-confesion[data-id="${id}"]`);
    if (!tarjeta) return;

    const boton = tarjeta.querySelector('.boton-leido');
    const estaLeidoActualmente = conjuntoLeidos.has(id);

    if (estaLeidoActualmente) {
        conjuntoLeidos.delete(id);
        tarjeta.classList.remove('leida');
        if (boton) {
            boton.classList.remove('esta-leido');
            boton.innerHTML = '<span class="icono-boton"></span><span>Marcar como leído</span>';
        }
    } else {
        conjuntoLeidos.add(id);
        tarjeta.classList.add('leida');
        if (boton) {
            boton.classList.add('esta-leido');
            boton.innerHTML = '<span class="icono-boton">✓</span><span>Leído</span>';
        }
    }

    guardarConjuntoLeidos(conjuntoLeidos);
};

// Crear elemento HTML para cada tarjeta
function crearTarjetaConfesionHTML(elemento, esNueva) {
    const id = obtenerIdConfesion(elemento);
    const conjuntoLeidos = obtenerConjuntoLeidos();
    const estaLeido = conjuntoLeidos.has(id);

    const tarjeta = document.createElement('div');
    tarjeta.className = `tarjeta-confesion ${esNueva ? 'nueva' : ''} ${estaLeido ? 'leida' : ''}`;
    tarjeta.dataset.id = id;

    const textoEscapado = String(elemento.confesion || '')
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    tarjeta.innerHTML = `
        <div class="comilla-tarjeta">“</div>
        <p>${textoEscapado}</p>
        <div class="pie-tarjeta">
            <button class="boton-leido ${estaLeido ? 'esta-leido' : ''}" onclick="alternarLeido('${id}', event)">
                <span class="icono-boton">${estaLeido ? '✓' : ''}</span>
                <span>${estaLeido ? 'Leído' : 'Marcar como leído'}</span>
            </button>
        </div>
    `;
    return tarjeta;
}

// =======================================================
// OBSERVADOR DE SCROLL: APARECER Y DESAPARECER MENSAJES
// =======================================================
const observadorScroll = new IntersectionObserver((entradas) => {
    entradas.forEach(entrada => {
        if (entrada.isIntersecting) {
            entrada.target.classList.add('visible');
        } else {
            entrada.target.classList.remove('visible');
        }
    });
}, {
    threshold: 0.08,
    rootMargin: '0px 0px -20px 0px'
});

function observarTodasLasTarjetas() {
    document.querySelectorAll('.tarjeta-confesion').forEach(tarjeta => {
        observadorScroll.observe(tarjeta);
    });
}

// Renderizado fluido y sincronizado
function actualizarListaConfesiones(nuevasConfesiones) {
    if (!nuevasConfesiones) nuevasConfesiones = [];

    // Ordenar de más antiguo (primer mensaje arriba) a más reciente (último mensaje abajo)
    nuevasConfesiones.sort((a, b) => {
        if (a.rowIndex !== undefined && b.rowIndex !== undefined) {
            return a.rowIndex - b.rowIndex;
        }
        return new Date(a.timestamp) - new Date(b.timestamp);
    });

    const nuevosIds = nuevasConfesiones.map(elemento => obtenerIdConfesion(elemento));
    const conjuntoNuevosIds = new Set(nuevosIds);

    let huboCambios = false;

    // 1. Detección y eliminación fluida de tarjetas ausentes
    const tarjetasActuales = Array.from(contenedorLista.querySelectorAll('.tarjeta-confesion'));
    tarjetasActuales.forEach(tarjeta => {
        const idTarjeta = tarjeta.dataset.id;
        if (!conjuntoNuevosIds.has(idTarjeta)) {
            observadorScroll.unobserve(tarjeta);
            tarjeta.style.opacity = '0';
            tarjeta.style.transform = 'scale(0.9)';
            tarjeta.style.maxHeight = '0';
            tarjeta.style.padding = '0';
            tarjeta.style.margin = '0';
            setTimeout(() => tarjeta.remove(), 400);
            huboCambios = true;
        }
    });

    // 2. Renderizado completo si la lista estaba vacía
    if (tarjetasActuales.length === 0 && nuevasConfesiones.length > 0) {
        contenedorLista.innerHTML = '';
        const fragmento = document.createDocumentFragment();
        nuevasConfesiones.forEach((elemento) => {
            const tarjeta = crearTarjetaConfesionHTML(elemento, false);
            fragmento.appendChild(tarjeta);
        });
        contenedorLista.appendChild(fragmento);
        observarTodasLasTarjetas();
        huboCambios = true;
    } else {
        // Inserción al final para nuevas confesiones que van llegando
        nuevasConfesiones.forEach((elemento) => {
            const id = obtenerIdConfesion(elemento);
            if (!marcasTiempoRenderizadas.has(id)) {
                const nuevaTarjeta = crearTarjetaConfesionHTML(elemento, true);
                contenedorLista.appendChild(nuevaTarjeta);
                observadorScroll.observe(nuevaTarjeta);
                huboCambios = true;
            }
        });
    }

    // 3. Manejo de estado vacío
    if (nuevasConfesiones.length === 0) {
        contenedorLista.innerHTML = `
            <div class="estado-vacio">
                <div class="icono-vacio">💌</div>
                <div class="titulo-vacio">Aún no hay confesiones</div>
                <p class="descripcion-vacia">Las nuevas confesiones enviadas aparecerán automáticamente aquí.</p>
            </div>
        `;
        huboCambios = true;
    }

    marcasTiempoRenderizadas = conjuntoNuevosIds;
    return huboCambios;
}

// Función principal para obtener datos (GET)
async function obtenerYRenderizarConfesiones() {
    try {
        const respuesta = await fetch(URL_SCRIPT);
        if (!respuesta.ok) throw new Error('Respuesta de red no válida');

        const datos = await respuesta.json();
        actualizarListaConfesiones(datos);
    } catch (error) {
        console.error('Error al obtener datos:', error);
    }
}

// Generar nubes adicionales dinámicas con propiedades aleatorias para mayor variación no uniforme
function crearNubesDinamicas() {
    const contenedor = document.getElementById('contenedor-nubes');
    const cantidadNubesExtra = 4;

    for (let i = 0; i < cantidadNubesExtra; i++) {
        const nube = document.createElement('div');
        nube.className = 'nube';

        const tamano = Math.floor(Math.random() * 180) + 140; // 140px a 320px
        const posicionSuperior = Math.floor(Math.random() * 88) + 2;   // 2% a 90%
        const opacidad = (Math.random() * 0.35 + 0.35).toFixed(2); // 0.35 a 0.70
        const velocidad = (Math.random() * 45 + 30).toFixed(1); // 30s a 75s
        const retraso = -(Math.random() * velocidad).toFixed(1); // offset inicial
        const duracionBalanceo = (Math.random() * 6 + 6).toFixed(1); // 6s a 12s
        const tipoOnda = (i % 3) + 1;

        nube.style.width = `${tamano}px`;
        nube.style.height = `${Math.floor(tamano * 0.58)}px`;
        nube.style.top = `${posicionSuperior}%`;
        nube.style.opacity = opacidad;
        nube.style.animation = `desplazamientoDerecha ${velocidad}s linear infinite, balanceoOnda${tipoOnda} ${duracionBalanceo}s ease-in-out infinite`;
        nube.style.animationDelay = `${retraso}s, ${-(Math.random() * 5).toFixed(1)}s`;

        contenedor.appendChild(nube);
    }
}

// Inicialización
crearNubesDinamicas();
obtenerYRenderizarConfesiones();
setInterval(obtenerYRenderizarConfesiones, INTERVALO_ACTUALIZACION);
