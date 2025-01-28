import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { showTranslatedError } from "@/lib/errorTranslator";

interface APIResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  duration: number;
}

export function APITester() {
  const [method, setMethod] = useState<string>("GET");
  const [endpoint, setEndpoint] = useState<string>("/api/");
  const [requestBody, setRequestBody] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<APIResponse | null>(null);
  const [history, setHistory] = useState<Array<{
    method: string;
    endpoint: string;
    response: APIResponse;
    timestamp: string;
  }>>([]);
  const { toast } = useToast();

  const handleTest = async () => {
    setLoading(true);
    const startTime = performance.now();

    try {
      const options: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      };

      if (method !== "GET" && requestBody) {
        try {
          options.body = JSON.stringify(JSON.parse(requestBody));
        } catch (e) {
          showTranslatedError(new Error("Invalid JSON format in request body"));
          setLoading(false);
          return;
        }
      }

      const res = await fetch(endpoint, options);
      const endTime = performance.now();
      const duration = endTime - startTime;

      const headers: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        headers[key] = value;
      });

      let data;
      const contentType = res.headers.get("content-type");
      try {
        if (contentType?.includes("application/json")) {
          data = await res.json();
        } else {
          data = await res.text();
        }

        const responseData: APIResponse = {
          status: res.status,
          statusText: res.statusText,
          headers,
          data,
          duration,
        };

        setResponse(responseData);
        setHistory(prev => [{
          method,
          endpoint,
          response: responseData,
          timestamp: new Date().toISOString(),
        }, ...prev.slice(0, 9)]); // Keep last 10 requests

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${data.message || res.statusText}`);
        }
      } catch (e) {
        showTranslatedError(e);
      }
    } catch (error) {
      showTranslatedError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">API Endpoint Tester</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Request Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Enter endpoint URL"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
              />
            </div>

            {method !== "GET" && (
              <Textarea
                placeholder="Request body (JSON)"
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                className="font-mono text-sm"
                rows={8}
              />
            )}

            <Button
              onClick={handleTest}
              disabled={loading}
              className="w-full"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Test Endpoint
            </Button>
          </CardContent>
        </Card>

        {/* Response Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Response</CardTitle>
          </CardHeader>
          <CardContent>
            {response ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                    response.status >= 200 && response.status < 300
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}>
                    {response.status} {response.statusText}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {response.duration.toFixed(2)}ms
                  </span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Headers</h3>
                  <pre className="bg-muted p-2 rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(response.headers, null, 2)}
                  </pre>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Body</h3>
                  <pre className="bg-muted p-2 rounded-md text-xs overflow-x-auto">
                    {typeof response.data === 'string'
                      ? response.data
                      : JSON.stringify(response.data, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Response will appear here after making a request
              </div>
            )}
          </CardContent>
        </Card>

        {/* History Panel */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Request History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No requests made yet
                </div>
              ) : (
                history.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-muted rounded-full text-xs font-medium">
                          {item.method}
                        </span>
                        <span className="text-sm font-medium">{item.endpoint}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.response.status >= 200 && item.response.status < 300
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}>
                      {item.response.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}