"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  useEffect(() => {
    supabase
      .from("trades")
      .select("*")
      .then(res => console.log(res));
  }, []);

  return <div>Check console</div>;
}
