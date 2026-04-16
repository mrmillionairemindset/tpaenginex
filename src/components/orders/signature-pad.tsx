"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

interface SignaturePadProps {
  orderId: string;
  signerRole: string;
  onSigned?: () => void;
}

export function SignaturePad({ orderId, signerRole, onSigned }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Set up canvas context on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas internal resolution to match display size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Fill white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Configure drawing style
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPosition = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const { x, y } = getPosition(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  }, [getPosition]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const { x, y } = getPosition(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDrawing, getPosition]);

  const stopDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(false);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Re-apply drawing style after clear
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    setHasDrawn(false);
  }, []);

  const handleSign = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!signerName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name before signing.",
        variant: "destructive",
      });
      return;
    }

    if (!hasDrawn) {
      toast({
        title: "Signature required",
        description: "Please draw your signature on the pad.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const signatureDataUrl = canvas.toDataURL("image/png");

      const res = await fetch(`/api/orders/${orderId}/signatures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerName: signerName.trim(),
          signerRole,
          signatureDataUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save signature");
      }

      toast({
        title: "Signature captured",
        description: "Your signature has been saved successfully.",
      });

      onSigned?.();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save signature",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [orderId, signerRole, signerName, hasDrawn, toast, onSigned]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signer-name">Signer Name</Label>
        <Input
          id="signer-name"
          placeholder="Enter your full name"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label>Signature</Label>
        <canvas
          ref={canvasRef}
          className="w-full border border-input rounded-md cursor-crosshair touch-none bg-white"
          style={{ height: 200, maxWidth: 400 }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        <p className="text-xs text-muted-foreground">
          Draw your signature above using your mouse or finger.
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={clearCanvas}
          disabled={isSubmitting}
        >
          Clear
        </Button>
        <Button
          type="button"
          onClick={handleSign}
          disabled={isSubmitting || !hasDrawn || !signerName.trim()}
        >
          {isSubmitting ? "Saving..." : "Sign"}
        </Button>
      </div>
    </div>
  );
}
