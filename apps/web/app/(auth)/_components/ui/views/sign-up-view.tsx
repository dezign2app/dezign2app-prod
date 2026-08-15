"use client";

import { SignUp } from "@clerk/nextjs";
import React, { useEffect, useState } from "react";
import { isElectron } from "@/lib/electron";
import { SignInView } from "./sign-in-view";

export const SignUpView = () => {
  const [inDesktop, setInDesktop] = useState(false);

  useEffect(() => {
    setInDesktop(isElectron());
  }, []);

  if (inDesktop) {
    return <SignInView />;
  }

  return <SignUp routing="hash" />;
};
