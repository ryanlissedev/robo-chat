export function AppInfoContent() {
  return (
    <div className="space-y-4">
      <p className="text-foreground leading-relaxed">
        <span className="font-medium">RoboRail Assistant</span> is an AI-powered technical support system
        designed specifically for the HGG RoboRail machine.
        <br />
        Built on GPT-5 with advanced reasoning capabilities for instant access
        to technical documentation, troubleshooting guidance, and operational instructions.
        <br />
        Multi-model support with BYOK functionality and fully self-hostable.
        <br />
      </p>
      <p className="text-foreground leading-relaxed">
        The code is available on{" "}
        <a
          href="https://github.com/HGG-Profiling/roborail-assistant"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          GitHub
        </a>
        .
      </p>
    </div>
  )
}
