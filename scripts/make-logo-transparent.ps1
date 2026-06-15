# One-off: convert council logo JPEG to transparent PNG.
# Mode "floodfill": edge-connected near-black becomes transparent (keeps enclosed dark details).
# Mode "whiteout": output pure white with alpha taken from pixel brightness (for white-on-black logos).
param(
    [string]$Source = "D:\Web Dev\hr-dashboard\public\council-logo-src.jpg",
    [string]$Destination = "D:\Web Dev\hr-dashboard\public\council-logo.png",
    [ValidateSet("floodfill", "whiteout")]
    [string]$Mode = "floodfill",
    [int]$Threshold = 48
)
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class LogoAlpha
{
    public static void Process(string src, string dst, int threshold)
    {
        using (var bmp = LoadArgb(src))
        {
            int w = bmp.Width, h = bmp.Height;
            var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            int stride = data.Stride;
            var px = new byte[stride * h];
            Marshal.Copy(data.Scan0, px, 0, px.Length);

            var visited = new bool[w * h];
            var queue = new Queue<int>();

            Action<int, int> tryEnqueue = (x, y) =>
            {
                int idx = y * w + x;
                if (visited[idx]) return;
                int o = y * stride + x * 4;
                if (px[o] < threshold && px[o + 1] < threshold && px[o + 2] < threshold)
                {
                    visited[idx] = true;
                    queue.Enqueue(idx);
                }
            };

            for (int x = 0; x < w; x++) { tryEnqueue(x, 0); tryEnqueue(x, h - 1); }
            for (int y = 0; y < h; y++) { tryEnqueue(0, y); tryEnqueue(w - 1, y); }

            while (queue.Count > 0)
            {
                int idx = queue.Dequeue();
                int x = idx % w, y = idx / w;
                px[y * stride + x * 4 + 3] = 0;
                if (x > 0) tryEnqueue(x - 1, y);
                if (x < w - 1) tryEnqueue(x + 1, y);
                if (y > 0) tryEnqueue(x, y - 1);
                if (y < h - 1) tryEnqueue(x, y + 1);
            }

            Marshal.Copy(px, 0, data.Scan0, px.Length);
            bmp.UnlockBits(data);
            bmp.Save(dst, ImageFormat.Png);
        }
    }

    public static void Whiteout(string src, string dst)
    {
        using (var bmp = LoadArgb(src))
        {
            int w = bmp.Width, h = bmp.Height;
            var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            int stride = data.Stride;
            var px = new byte[stride * h];
            Marshal.Copy(data.Scan0, px, 0, px.Length);

            for (int y = 0; y < h; y++)
            {
                for (int x = 0; x < w; x++)
                {
                    int o = y * stride + x * 4;
                    byte b = px[o], g = px[o + 1], r = px[o + 2];
                    byte lum = Math.Max(r, Math.Max(g, b));
                    px[o] = 255; px[o + 1] = 255; px[o + 2] = 255; px[o + 3] = lum;
                }
            }

            Marshal.Copy(px, 0, data.Scan0, px.Length);
            bmp.UnlockBits(data);
            bmp.Save(dst, ImageFormat.Png);
        }
    }

    private static Bitmap LoadArgb(string src)
    {
        using (var original = new Bitmap(src))
        {
            var bmp = new Bitmap(original.Width, original.Height, PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(bmp))
            {
                g.DrawImage(original, 0, 0, original.Width, original.Height);
            }
            return bmp;
        }
    }
}
"@ -ReferencedAssemblies System.Drawing

if ($Mode -eq "whiteout") {
    [LogoAlpha]::Whiteout($Source, $Destination)
} else {
    [LogoAlpha]::Process($Source, $Destination, $Threshold)
}
Write-Output "done"
