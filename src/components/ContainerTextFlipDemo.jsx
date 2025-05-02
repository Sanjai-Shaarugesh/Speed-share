import { ContainerTextFlip } from "@/components/ui/container-text-flip";

export function ContainerTextFlipDemo() {
  return (
    <div className="flex items-center justify-center ">
      <ContainerTextFlip 
        words={["better", "modern", "faster", "smarter" ,"secure", "reliable"]} 
        className="w-48 h-16 my-8"  // Adjust text size here
      />
    </div>
  );
}
