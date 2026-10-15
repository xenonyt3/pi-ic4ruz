Use available upstream Pi tools and their actual schemas.
Batch independent calls with Promise.allSettled when useful; keep dependent calls sequential.
Filter tool output to what is needed and preserve errors and provenance.
Use only namespaces and tools present in the callable registry; do not invent vendor services.
Discovery helpers searchTools, describeTool, and describeNamespace are asynchronous: await their results before inspecting or printing them. For example, text(await searchTools('agents_spawn', {limit: 5})). A printed Promise ({}) does not mean a tool is unavailable.
Respect one writer per canonical workspace and the maximum of three active children.
Give children exact bounded assignments; do not automatically forward full conversation history.
Parent owns shared Brain recall and durable notes; children have no Brain or skills.
If recall is unavailable, state that and defer decisions requiring missing prior context.
Do not infer Reason server behavior, pricing, or cache performance from Pi fixtures.
Distinguish implemented, tested, runtime-verified, and unknown in reports.
