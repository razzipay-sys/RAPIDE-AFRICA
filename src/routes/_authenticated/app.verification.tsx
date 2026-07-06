import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Upload, FileText, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/app/verification")({
  component: VerificationScreen,
});

function VerificationScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);

  // useAuth() only exposes the raw auth user, not the profiles row — fetch
  // it directly (kyc_status lives on profiles, not on the auth session).
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, kyc_status")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const uploadDoc = useMutation({
    mutationFn: async () => {
      if (!file || !user) return;

      const fileExt = file.name.split(".").pop();
      const fileName = `user_${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `kyc_documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("documents").getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          id_document_url: publicUrl,
          kyc_status: "in_review",
        })
        .eq("id", user.id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Document submitted for review");
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      navigate({ to: "/app" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Upload failed");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/app" className="h-10 w-10 glass rounded-full flex items-center justify-center">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-2xl font-bold">Account Verification</h1>
      </div>

      <div className="glass rounded-3xl p-6">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <h2 className="font-bold text-lg mb-2">Verify Your Identity</h2>
        <p className="text-sm text-muted-foreground mb-6">
          To ensure community safety, we require users to upload a valid government ID before
          sending packages.
        </p>

        {profile?.kyc_status === "approved" ? (
          <div className="flex flex-col items-center justify-center py-6 text-center border-t border-white/10 pt-6">
            <CheckCircle2 className="h-12 w-12 text-green-400 mb-3" />
            <h3 className="font-bold text-lg mb-1">Fully Verified</h3>
            <p className="text-sm text-muted-foreground">
              Thank you for keeping our platform secure.
            </p>
          </div>
        ) : profile?.kyc_status === "in_review" ? (
          <div className="flex flex-col items-center justify-center py-6 text-center border-t border-white/10 pt-6">
            <Clock className="h-12 w-12 text-yellow-400 mb-3" />
            <h3 className="font-bold text-lg mb-1">Under Review</h3>
            <p className="text-sm text-muted-foreground">Our team is reviewing your document.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-2xl p-8 text-center relative overflow-hidden group">
              <input
                type="file"
                accept="image/*,.pdf"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition">
                  {file ? <FileText className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {file ? file.name : "Tap to upload National ID"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {file
                      ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                      : "JPEG, PNG or PDF (Max 5MB)"}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => uploadDoc.mutate()}
              disabled={!file || uploadDoc.isPending}
              className="w-full py-4 rounded-2xl bg-gradient-primary text-primary-foreground font-bold shadow-glow disabled:opacity-50 transition active:scale-95"
            >
              {uploadDoc.isPending ? "Uploading..." : "Submit Document"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
