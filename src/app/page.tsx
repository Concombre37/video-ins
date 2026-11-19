"use client";

import { NewVideoForm } from "@/components/NewVideoForm";
import { PageLayout } from "@/components/PageLayout";
import type { NextPage } from "next";

const Home: NextPage = () => (
  <PageLayout>
    <NewVideoForm />
  </PageLayout>
);

export default Home;
