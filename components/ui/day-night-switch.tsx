"use client";

import * as React from "react";
import {
  motion,
  AnimatePresence,
  type Variants,
  type MotionProps,
} from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type DayNightSwitchProps = {
  defaultChecked?: boolean;
  onToggle?: (checked: boolean) => void;
} & React.HTMLAttributes<HTMLDivElement> &
  MotionProps;

type AnimationMode = keyof typeof backgroundVariants;

const backgroundVariants: Variants = {
  day: {
    background: "linear-gradient(to bottom, #87CEEB, #E0F7FA)",
    transition: { duration: 0.7 },
  },
  sunset: {
    background: "linear-gradient(to bottom, #FF7E5F, #FEB47B, #D76D77)",
    transition: { duration: 0.7 },
  },
  night: {
    background: "linear-gradient(to bottom, #0F2027, #203A43, #2C5364)",
    transition: { duration: 0.7 },
  },
};

const sunVariants: Variants = {
  visible: { y: 0, opacity: 1 },
  sunset: { y: 24, opacity: 0.9, scale: 1.2, transition: { duration: 0.7 } },
  hidden: { y: 40, opacity: 0, transition: { duration: 0.4 } },
};

const moonVariants: Variants = {
  hidden: { y: -30, opacity: 0 },
  rising: { y: 0, opacity: 1, transition: { delay: 0.5, duration: 0.7 } },
};

const cloudVariants: Variants = {
  visible: { opacity: 0.9, x: 0 },
  hidden: { opacity: 0, x: -30, transition: { duration: 0.5 } },
};

const createStarVariants = (index: number): Variants => ({
  hidden: { opacity: 0, scale: 0 },
  visible: {
    opacity: [0, 0.8, 0.6 + Math.random() * 0.4],
    scale: [0, 0.8 + Math.random() * 0.4, 0.6 + Math.random() * 0.4],
    transition: {
      delay: 0.7 + index * 0.12,
      duration: 0.8,
    },
  },
});

const DayNightSwitch = React.forwardRef<HTMLDivElement, DayNightSwitchProps>(
  ({ className, defaultChecked = true, onToggle, ...restProps }, ref) => {
    const id = React.useId();
    const [checked, setChecked] = React.useState<boolean>(defaultChecked);

    const handleToggle = (newValue: boolean) => {
      setChecked(newValue);
      onToggle?.(newValue);
    };

    const currentMode: AnimationMode = checked ? "day" : "night";

    return (
      <motion.div
        ref={ref}
        className={cn(
          "relative w-20 h-10 rounded-md overflow-hidden border shadow",
          className
        )}
        variants={backgroundVariants}
        animate={currentMode}
        initial={currentMode}
        {...restProps}
      >
        <div className="relative h-full w-full">
          <AnimatePresence>
            {checked && (
              <motion.div
                className="absolute w-6 h-6 bg-yellow-400 rounded-full"
                style={{
                  left: "25%",
                  top: "50%",
                  marginTop: -12,
                  marginLeft: -12,
                }}
                variants={sunVariants}
                initial="visible"
                animate={checked ? "visible" : "sunset"}
                exit="hidden"
              >
                <SunRays />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {!checked && (
              <motion.div
                className="absolute w-5 h-5"
                style={{
                  left: "75%",
                  top: "50%",
                  marginTop: -10,
                  marginLeft: -10,
                }}
                variants={moonVariants}
                initial="hidden"
                animate={!checked ? "rising" : "hidden"}
              >
                <Moon />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>{checked && <Clouds />}</AnimatePresence>

          <AnimatePresence>{!checked && <Stars count={10} />}</AnimatePresence>

          <div className="absolute inset-0 flex items-center justify-center">
            <Switch
              id={id}
              checked={checked}
              onCheckedChange={handleToggle}
              className={cn(
                "peer data-[state=unchecked]:bg-transparent data-[state=checked]:bg-transparent absolute inset-0 h-[inherit] w-auto [&_span]:z-10 [&_span]:size-6 [&_span]:border [&_span]:shadow [&_span]:rounded-sm [&_span]:transition-transform [&_span]:duration-500 [&_span]:[transition-timing-function:cubic-bezier(0.16,1,0.3,1)] [&_span]:data-[state=checked]:translate-x-10 [&_span]:data-[state=unchecked]:translate-x-2 [&_span]:bg-white [&_span]:border-gray-300"
              )}
            />
          </div>
        </div>

        <Label htmlFor={id} className="sr-only">
          Day/Night Theme Switch
        </Label>
      </motion.div>
    );
  }
);

const SunRays = () => (
  <>
    {[...Array(8)].map((_, i) => (
      <div
        key={`ray-${i}`}
        className="absolute bg-yellow-300 w-1 h-2"
        style={{
          left: "50%",
          top: "50%",
          transformOrigin: "0 0",
          transform: `rotate(${
            i * 45
          }deg) translate(-50%, -50%) translate(10px, 0)`,
        }}
      />
    ))}
  </>
);

const Moon = () => (
  <div className="relative w-full h-full">
    <div className="absolute inset-0 bg-gray-100 rounded-full" />
    <div
      className="absolute bg-[#0F2027] rounded-full"
      style={{
        width: "90%",
        height: "90%",
        top: "-10%",
        left: "-25%",
      }}
    />
  </div>
);

const Clouds = () => (
  <>
    <motion.div
      className="absolute left-[60%] top-[30%] w-8 h-3 bg-white rounded-full opacity-90"
      variants={cloudVariants}
      initial="visible"
      animate="visible"
      exit="hidden"
    />
    <motion.div
      className="absolute left-[70%] top-[60%] w-6 h-2.5 bg-white rounded-full opacity-80"
      variants={cloudVariants}
      initial="visible"
      animate="visible"
      exit="hidden"
    />
  </>
);

type StarsProps = {
  count: number;
};

const Stars = ({ count }: StarsProps) => (
  <>
    {[...Array(count)].map((_, i) => (
      <motion.div
        key={`star-${i}`}
        className="absolute w-0.5 h-0.5 bg-white rounded-full"
        style={{
          left: `${10 + i * 8}%`,
          top: `${20 + (i % 5) * 12}%`,
          boxShadow: "0 0 2px 1px rgba(255, 255, 255, 0.4)",
        }}
        variants={createStarVariants(i)}
        initial="hidden"
        animate="visible"
        exit="hidden"
      />
    ))}
  </>
);

DayNightSwitch.displayName = "DayNightSwitch";

export { DayNightSwitch };