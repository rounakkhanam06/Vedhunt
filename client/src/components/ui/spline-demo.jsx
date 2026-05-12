import { SplineScene } from "@/components/ui/splite";
import { Card } from "@/components/ui/card";
import { Spotlight } from "@/components/ui/spotlight";

export function SplineSceneBasic() {
  return (
    <Card className="w-full h-[500px] bg-app-card/30 dark:bg-app-card/20 backdrop-blur-md relative overflow-hidden border border-app-border">
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
      />
      
      <div className="flex flex-col md:flex-row h-full">
        {/* Left content */}
        <div className="flex-1 p-8 relative z-10 flex flex-col justify-center">
          <h1 className="text-4xl md:text-5xl font-black font-heading bg-clip-text text-transparent bg-gradient-to-b from-app-text to-app-text-muted">
            Interactive 3D
          </h1>
          <p className="mt-4 text-app-text-muted max-w-lg text-sm sm:text-base">
            Bring your UI to life with beautiful 3D scenes. Create immersive experiences 
            that capture attention and enhance your design.
          </p>
        </div>

        {/* Right content */}
        <div className="flex-1 relative min-h-[300px] md:min-h-auto">
          <SplineScene 
            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
            className="w-full h-full"
          />
        </div>
      </div>
    </Card>
  )
}
export default SplineSceneBasic;
