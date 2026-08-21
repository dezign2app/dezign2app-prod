import React, { ReactNode } from "react";

export const AuthLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="h-screen w-screen overflow-y-scroll overflow-x-hidden flex items-center justify-center">
      {children}
    </div>
  );
};
