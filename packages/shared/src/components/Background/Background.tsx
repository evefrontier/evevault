import type { ReactNode } from "react";

interface BackgroundProps {
  children: ReactNode;
  bottomOffset?: number;
}

const Background = ({ children, bottomOffset = 0 }: BackgroundProps) => {
  return (
    <div
      className="relative h-full w-full min-h-screen flex-1 overflow-hidden"
      style={{
        backgroundImage: `url("/images/evevault-background.png")`,
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center center",
        paddingBottom: bottomOffset,
      }}
    >
      {children}
    </div>
  );
};

export default Background;
