async function main() {
    try {
        const response = await fetch("https://openrouter.ai/api/v1/models");
        const data = await response.json();
        const freeModels = data.data.filter(m => m.id.endsWith(':free') || m.id === 'openrouter/free');
        console.log("Modelos gratuitos disponibles en OpenRouter:");
        freeModels.forEach(m => console.log(`- ${m.id} (${m.name})`));
    } catch (e) {
        console.error("Error al obtener modelos:", e);
    }
}
main();
