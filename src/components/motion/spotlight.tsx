"use client";

import { cn } from "@/lib/utils";

/**
 * Effet "spotlight" qui suit le curseur — utilise une grosse tache lumineuse
 * en background-image conditionnée par les variables CSS --mouse-x / --mouse-y.
 */
export function Spotlight({
  className,
  fill = "white",
}: {
  className?: string;
  fill?: string;
}) {
  return (
    <svg
      className={cn(
        "pointer-events-none absolute opacity-50 mix-blend-screen",
        "animate-[spotlight_8s_ease-in-out_infinite_alternate]",
        className
      )}
      viewBox="0 0 3787 2842"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <g filter="url(#filter)">
        <ellipse
          cx="1924.71"
          cy="273.501"
          rx="1924.71"
          ry="273.501"
          transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)"
          fill={fill}
          fillOpacity="0.21"
        />
      </g>
      <defs>
        <filter
          id="filter"
          x="0.860352"
          y="0.838989"
          width="3785.16"
          height="2840.26"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="BackgroundImageFix"
            result="shape"
          />
          <feGaussianBlur
            stdDeviation="151"
            result="effect1_foregroundBlur_1065_8"
          />
        </filter>
      </defs>
    </svg>
  );
}
