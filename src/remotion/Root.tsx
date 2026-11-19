import React from "react";
import { Composition } from "remotion";
import { DEFAULT_FORMAT, FORMATS, isVideoFormat } from "../lib/video-settings";
import { DynamicComp } from "./DynamicComp";

const defaultCode = `import { AbsoluteFill } from "remotion";
export const MyAnimation = () => <AbsoluteFill style={{ backgroundColor: "#000" }} />;`;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DynamicComp"
        component={DynamicComp}
        durationInFrames={300}
        fps={30}
        width={FORMATS[DEFAULT_FORMAT].width}
        height={FORMATS[DEFAULT_FORMAT].height}
        defaultProps={{ code: defaultCode }}
        calculateMetadata={({ props }) => {
          const format = isVideoFormat(props.format) ? props.format : DEFAULT_FORMAT;
          return {
            durationInFrames: props.durationInFrames as number,
            fps: props.fps as number,
            width: FORMATS[format].width,
            height: FORMATS[format].height,
          };
        }}
      />
    </>
  );
};
