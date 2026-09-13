#!/usr/bin/env python3
import sys
import json
import urllib.request
import asyncio
import argparse
import time
import os
import base64

def get_chrome_ws_url():
    """
    Polls Chrome's REST endpoint to locate the active PWA tab's WebSocket debugger URL.
    """
    try:
        url = "http://127.0.0.1:9222/json"
        with urllib.request.urlopen(url, timeout=2) as response:
            pages = json.loads(response.read().decode())
            target = next((p for p in pages if ":5173/elszamolos/" in p.get("url", "") and p.get("type") == "page"), None)
            if not target:
                target = next((p for p in pages if p.get("type") == "page"), None)
            if target:
                return target.get("webSocketDebuggerUrl")
    except Exception as e:
        sys.stderr.write(f"Error querying Chrome debug port 9222: {e}\n")
    return None

async def evaluate_cdp(ws_url, js_code):
    """
    Evaluates JavaScript in the Chrome tab using the Chrome DevTools Protocol via websockets.
    """
    import websockets
    try:
        async with websockets.connect(ws_url, max_size=20 * 1024 * 1024) as ws:
            request_id = int(time.time() * 1000) % 1000000
            payload = {
                "id": request_id,
                "method": "Runtime.evaluate",
                "params": {
                    "expression": js_code,
                    "awaitPromise": True,
                    "returnByValue": True
                }
            }
            await ws.send(json.dumps(payload))
            
            async for message in ws:
                res = json.loads(message)
                if res.get("id") == request_id:
                    result = res.get("result", {})
                    if "exceptionDetails" in result:
                        return {
                            "status": "error",
                            "error": result["exceptionDetails"].get("exception", {}).get("description", "JS Execution Exception"),
                            "exception": result["exceptionDetails"]
                        }
                    return {
                        "status": "success",
                        "data": result.get("result", {}).get("value")
                    }
    except Exception as e:
        return {
            "status": "error",
            "error": f"WebSocket evaluation failed: {e}"
        }

async def print_to_pdf_cdp(ws_url):
    """
    Commands Chrome to render the current tab body to a PDF vector document.
    """
    import websockets
    try:
        async with websockets.connect(ws_url, max_size=20 * 1024 * 1024) as ws:
            request_id = int(time.time() * 1000) % 1000000
            payload = {
                "id": request_id,
                "method": "Page.printToPDF",
                "params": {
                    "printBackground": True,
                    "paperWidth": 8.27,
                    "paperHeight": 11.69,
                    "marginTop": 0.4,
                    "marginBottom": 0.4,
                    "marginLeft": 0.4,
                    "marginRight": 0.4
                }
            }
            await ws.send(json.dumps(payload))
            
            async for message in ws:
                res = json.loads(message)
                if res.get("id") == request_id:
                    if "error" in res:
                        return {"status": "error", "error": res["error"].get("message", "CDP Print PDF Error")}
                    pdf_base64 = res.get("result", {}).get("data")
                    return {"status": "success", "data": pdf_base64}
    except Exception as e:
        return {"status": "error", "error": f"CDP PDF Print failed: {e}"}

async def run_action(ws_url, action, **kwargs):
    """
    Constructs the dynamic console imports and executes them inside Chrome, returning the optimal JSON format.
    """
    js_code = ""
    
    if action == "fetch-jobs":
        js_code = """
        (async () => {
            const { dbService } = await import('/elszamolos/src/services/db.ts');
            return await dbService.getAllJobs();
        })()
        """
        
    elif action == "fetch-invoices":
        js_code = """
        (async () => {
            const { dbService } = await import('/elszamolos/src/services/db.ts');
            return await dbService.getAllInvoices();
        })()
        """
        
    elif action == "fetch-tariff-rules":
        js_code = """
        (async () => {
            const { dbService } = await import('/elszamolos/src/services/db.ts');
            return await dbService.getAllRules();
        })()
        """
        
    elif action == "fetch-logs":
        js_code = """
        (async () => {
            const { dbService } = await import('/elszamolos/src/services/db.ts');
            return await dbService.getAllLogs();
        })()
        """
        
    elif action == "fetch-units":
        project_id = kwargs.get("project_id")
        js_code = f"""
        (async () => {{
            const {{ dbService }} = await import('/elszamolos/src/services/db.ts');
            const jobs = await dbService.getAllJobs();
            const job = jobs.find(j => j.projectId === '{project_id}' || j.id === '{project_id}');
            return job ? job.teeth : null;
        }})()
        """
        
    elif action == "fetch-recognized-attributes":
        js_code = """
        (async () => {
            const { dbService } = await import('/elszamolos/src/services/db.ts');
            const [materials, types, doctors, patients] = await Promise.all([
                dbService.getMetadata('materials'),
                dbService.getMetadata('types'),
                dbService.getMetadata('doctors'),
                dbService.getMetadata('patients')
            ]);
            return { materials, types, doctors, patients };
        })()
        """
        
    elif action == "create-tariff":
        rule_payload = kwargs.get("rule_json")
        serialized_rule = json.dumps(json.loads(rule_payload), ensure_ascii=False)
        js_code = f"""
        (async () => {{
            try {{
                const {{ dbService }} = await import('/elszamolos/src/services/db.ts');
                const rule = {serialized_rule};
                await dbService.addRule(rule);
                setTimeout(() => window.location.reload(), 200);
                return {{ success: true, message: `Successfully created rule '${{rule.name}}'.` }};
            }} catch(err) {{
                return {{ error: err.toString(), stack: err.stack }};
            }}
        }})()
        """
        
    elif action == "create-job":
        job_payload = kwargs.get("job_json")
        serialized_job = json.dumps(json.loads(job_payload), ensure_ascii=False)
        js_code = f"""
        (async () => {{
            try {{
                const {{ dbService }} = await import('/elszamolos/src/services/db.ts');
                const {{ calculateJobPrice }} = await import('/elszamolos/src/services/pricingEngine.ts');
                const rules = await dbService.getAllRules();
                const rawJob = {serialized_job};
                const calculatedJob = calculateJobPrice(rawJob, rules) || rawJob;
                await dbService.addJob(calculatedJob);
                setTimeout(() => window.location.reload(), 200);
                return {{ success: true, message: `Successfully created job for '${{calculatedJob.patientName}}'.` }};
            }} catch(err) {{
                return {{ error: err.toString(), stack: err.stack }};
            }}
        }})()
        """
        
    elif action == "create-invoice":
        doctor_name = kwargs.get("doctor_name")
        job_ids = kwargs.get("job_ids")
        serialized_ids = json.dumps(job_ids, ensure_ascii=False)
        js_code = f"""
        (async () => {{
            try {{
                const {{ dbService }} = await import('/elszamolos/src/services/db.ts');
                const invoices = await dbService.getAllInvoices();
                const jobIds = {serialized_ids};
                
                // Construct a new invoice Number (e.g. INV-2026-004)
                const year = new Date().getFullYear();
                const count = invoices.length;
                const invoiceNumber = `INV-${{year}}-${{String(count + 1).padStart(3, '0')}}`;
                
                const newInvoice = {{
                    id: crypto.randomUUID(),
                    invoiceNumber,
                    doctorName: '{doctor_name}',
                    createdAt: new Date().toISOString(),
                    jobCount: jobIds.length,
                    totalAmount: 0,
                    currency: 'HUF'
                }};
                
                // Add the invoice shell to the DB
                await dbService.addInvoice(newInvoice);
                
                // Assign and lock the jobs under this invoice (triggers automatic totals calculation)
                const updatedInvoice = await dbService.assignJobsToInvoice(newInvoice.id, jobIds);
                
                setTimeout(() => window.location.reload(), 200);
                
                return {{
                    success: true,
                    invoice: updatedInvoice
                }};
            }} catch(err) {{
                return {{ error: err.toString(), stack: err.stack }};
            }}
        }})()
        """
        
    elif action == "save-app-state":
        js_code = """
        (async () => {
            try {
                const { initDB } = await import('/elszamolos/src/services/db.ts');
                const db = await initDB();
                
                const jobs = await db.getAll('jobs');
                const tariffs = await db.getAll('tariffs');
                const invoices = await db.getAll('invoices');
                const logs = await db.getAll('logs');
                
                // Fetch metadata
                const metadata = {};
                const keys = ['materials', 'types', 'doctors', 'patients'];
                for (const key of keys) {
                    metadata[key] = (await db.get('metadata', key)) || [];
                }
                
                // Fetch assets and convert Blobs to base64 data URLs
                const rawAssets = await db.getAll('assets');
                const assets = [];
                for (const asset of rawAssets) {
                    const base64Data = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(asset.data);
                    });
                    assets.push({
                        id: asset.id,
                        jobId: asset.jobId,
                        fileName: asset.fileName,
                        mimeType: asset.mimeType,
                        size: asset.size,
                        createdAt: asset.createdAt,
                        data: base64Data
                    });
                }
                
                return {
                    jobs,
                    tariffs,
                    invoices,
                    metadata,
                    assets,
                    logs
                };
            } catch(err) {
                return { error: err.toString(), stack: err.stack };
            }
        })()
        """
        
    elif action == "load-app-state":
        json_file = kwargs.get("json_file")
        if not os.path.exists(json_file):
            return {"status": "error", "error": f"File '{json_file}' not found on host."}
            
        with open(json_file, 'r', encoding='utf-8') as f:
            payload = json.load(f)
            
        serialized_payload = json.dumps(payload, ensure_ascii=False)
        
        js_code = f"""
        (async () => {{
            try {{
                const {{ initDB }} = await import('/elszamolos/src/services/db.ts');
                const db = await initDB();
                const payload = {serialized_payload};
                
                // 1. Clear all existing object stores
                await db.clear('jobs');
                await db.clear('tariffs');
                await db.clear('invoices');
                await db.clear('metadata');
                await db.clear('logs');
                await db.clear('assets');
                
                // 2. Restore jobs
                if (payload.jobs) {{
                    for (const job of payload.jobs) {{
                        await db.put('jobs', job);
                    }}
                }}
                
                // 3. Restore tariffs
                if (payload.tariffs) {{
                    for (const tariff of payload.tariffs) {{
                        await db.put('tariffs', tariff);
                    }}
                }}
                
                // 4. Restore invoices
                if (payload.invoices) {{
                    for (const invoice of payload.invoices) {{
                        await db.put('invoices', invoice);
                    }}
                }}
                
                // 5. Restore metadata
                if (payload.metadata) {{
                    for (const key of Object.keys(payload.metadata)) {{
                        await db.put('metadata', payload.metadata[key], key);
                    }}
                }}
                
                // 6. Restore logs
                if (payload.logs) {{
                    for (const log of payload.logs) {{
                        await db.put('logs', log);
                    }}
                }}
                
                // 7. Restore assets (convert base64 data URLs back to Blobs)
                if (payload.assets) {{
                    for (const asset of payload.assets) {{
                        const blob = await fetch(asset.data).then(res => res.blob());
                        await db.put('assets', {{
                            id: asset.id,
                            jobId: asset.jobId,
                            fileName: asset.fileName,
                            mimeType: asset.mimeType,
                            size: asset.size,
                            createdAt: asset.createdAt,
                            data: blob
                        }});
                    }}
                }}
                
                setTimeout(() => window.location.reload(), 200);
                
                return {{
                    success: true,
                    message: "Database state successfully loaded and restored atomically!"
                }};
            }} catch(err) {{
                return {{ error: err.toString(), stack: err.stack }};
            }}
        }})()
        """
        
    elif action == "job-import-json":
        json_file = kwargs.get("json_file")
        if not os.path.exists(json_file):
            return {"status": "error", "error": f"File '{json_file}' not found on host."}
            
        with open(json_file, 'r', encoding='utf-8') as f:
            jobs_payload = json.load(f)
            
        # If payload is a single object, wrap in a list
        if not isinstance(jobs_payload, list):
            jobs_payload = [jobs_payload]
            
        serialized_jobs = json.dumps(jobs_payload, ensure_ascii=False)
        
        js_code = f"""
        (async () => {{
            try {{
                const {{ dbService }} = await import('/elszamolos/src/services/db.ts');
                const {{ calculateJobPrice }} = await import('/elszamolos/src/services/pricingEngine.ts');
                const rules = await dbService.getAllRules();
                const jobsToImport = {serialized_jobs};
                
                let importedCount = 0;
                for (const rawJob of jobsToImport) {{
                    // Execute actual pricing engine on the imported job
                    const calculatedJob = calculateJobPrice(rawJob, rules) || rawJob;
                    
                    // Add or overwrite the job in IndexedDB
                    await dbService.updateJob(calculatedJob);
                    importedCount++;
                }}
                
                // Refresh the PWA UI to display the newly imported jobs immediately
                setTimeout(() => window.location.reload(), 200);
                
                return {{
                    imported_count: importedCount,
                    message: `Successfully imported ${{importedCount}} jobs with live calculated prices.`
                }};
            }} catch(err) {{
                return {{ error: err.toString(), stack: err.stack }};
            }}
        }})()
        """
        
    elif action == "tariff-rules-import-json":
        json_file = kwargs.get("json_file")
        if not os.path.exists(json_file):
            return {"status": "error", "error": f"File '{json_file}' not found on host."}
            
        with open(json_file, 'r', encoding='utf-8') as f:
            rules_payload = json.load(f)
            
        if not isinstance(rules_payload, list):
            rules_payload = [rules_payload]
            
        serialized_rules = json.dumps(rules_payload, ensure_ascii=False)
        
        js_code = f"""
        (async () => {{
            try {{
                const {{ dbService }} = await import('/elszamolos/src/services/db.ts');
                const {{ validateRule }} = await import('/elszamolos/src/services/pricingUtils.ts');
                
                const rulesToImport = {serialized_rules};
                const availableMaterials = await dbService.getMetadata('materials');
                const availableTypes = await dbService.getMetadata('types');
                
                const validRules = [];
                const errors = [];
                
                for (let i = 0; i < rulesToImport.length; i++) {{
                    const r = rulesToImport[i];
                    
                    // Basic structural validation using native utility
                    if (!validateRule(r)) {{
                        errors.push(`Rule #${{i+1}} '${{r.name || 'unnamed'}}': Malformed rule structure.`);
                        continue;
                    }}
                    
                    // Native domain-level validation
                    let isRuleValid = true;
                    for (const c of r.conditions) {{
                        if ((c.operator === 'isOneOf' || c.operator === 'notOneOf') && !Array.isArray(c.value)) {{
                            errors.push(`Rule '${{r.name}}': Operator '${{c.operator}}' requires an array value.`);
                            isRuleValid = false;
                        }}
                        const values = Array.isArray(c.value) ? c.value : [c.value];
                        if (c.field === 'material') {{
                            for (const v of values) {{
                                if (v && !availableMaterials.includes(v)) {{
                                    errors.push(`Rule '${{r.name}}': Unknown material '${{v}}'`);
                                    isRuleValid = false;
                                }}
                            }}
                        }}
                        if (c.field === 'type') {{
                            for (const v of values) {{
                                if (v && !availableTypes.includes(v)) {{
                                    errors.push(`Rule '${{r.name}}': Unknown type '${{v}}'`);
                                    isRuleValid = false;
                                }}
                            }}
                        }}
                    }}
                    
                    if (isRuleValid) {{
                        validRules.push(r);
                    }}
                }}
                
                // Add valid rules to IndexedDB
                for (const r of validRules) {{
                    await dbService.updateRule(r);
                }}
                
                // Trigger pricing recalculation live in Chrome across all jobs
                if (validRules.length > 0) {{
                    const jobs = await dbService.getAllJobs();
                    const allRules = await dbService.getAllRules();
                    const {{ calculateJobPrice }} = await import('/elszamolos/src/services/pricingEngine.ts');
                    
                    for (const job of jobs) {{
                        if (job.status !== 'Discarded' && job.status !== 'Invoiced') {{
                            const recalc = calculateJobPrice(job, allRules);
                            if (recalc) {{
                                await dbService.updateJob(recalc);
                            }}
                        }}
                    }}
                }}
                
                setTimeout(() => window.location.reload(), 200);
                
                return {{
                    valid_imported_count: validRules.length,
                    validation_errors_count: errors.length,
                    validation_errors: errors
                }};
            }} catch(err) {{
                return {{ error: err.toString(), stack: err.stack }};
            }}
        }})()
        """
        
    elif action == "render-invoice":
        invoice_id = kwargs.get("invoice_id")
        js_code = f"""
        (async () => {{
            try {{
                const {{ dbService }} = await import('/elszamolos/src/services/db.ts');
                const {{ groupJobsByDoctor, groupToothLines, getJobExtraLines }} = await import('/elszamolos/src/utils/invoiceGrouping.ts');
                
                const invoices = await dbService.getAllInvoices();
                const invoice = invoices.find(inv => inv.id === '{invoice_id}');
                if (!invoice) return {{ error: 'Invoice not found: {invoice_id}' }};
                
                const allJobs = await dbService.getAllJobs();
                const jobs = allJobs.filter(j => j.parentInvoiceId === '{invoice_id}');
                
                const grouped = groupJobsByDoctor(jobs);
                
                // Construct styled HTML matching production print view perfectly
                let html = `
                <html>
                <head>
                    <style>
                        body {{
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            margin: 0;
                            padding: 40px;
                            color: #334155;
                            background-color: white;
                        }}
                        .page {{
                            max-width: 800px;
                            margin: 0 auto;
                            padding: 20px;
                            page-break-after: always;
                        }}
                        .page:last-child {{
                            page-break-after: avoid;
                        }}
                        .header {{
                            display: flex;
                            justify-content: space-between;
                            align-items: baseline;
                            border-bottom: 2px solid #f1f5f9;
                            padding-bottom: 20px;
                            margin-bottom: 30px;
                        }}
                        .doc-name {{
                            font-size: 1.5rem;
                            font-weight: bold;
                            color: #1e293b;
                        }}
                        .doc-meta {{
                            font-size: 0.85rem;
                            color: #64748b;
                        }}
                        .job-container {{
                            margin-bottom: 40px;
                        }}
                        .job-header {{
                            display: flex;
                            justify-content: space-between;
                            background-color: #f8fafc;
                            padding: 10px 15px;
                            border: 1px solid #e2e8f0;
                            border-bottom: none;
                            font-weight: bold;
                        }}
                        .job-title {{
                            font-size: 0.95rem;
                            color: #1e293b;
                        }}
                        table {{
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 20px;
                        }}
                        th, td {{
                            padding: 10px 15px;
                            text-align: left;
                            font-size: 0.85rem;
                            border: 1px solid #e2e8f0;
                        }}
                        th {{
                            background-color: #f8fafc;
                            color: #64748b;
                            font-weight: 600;
                        }}
                        .total-section {{
                            display: flex;
                            justify-content: flex-end;
                            margin-top: 30px;
                            font-size: 1.1rem;
                            font-weight: bold;
                            color: #1e293b;
                        }}
                    </style>
                </head>
                <body>
                `;
                
                for (const [doctorName, docJobs] of Object.entries(grouped)) {{
                    html += `
                    <div class="page">
                        <div class="header">
                            <div>
                                <div class="doc-name">${{doctorName}}</div>
                                <div class="doc-meta">Dátum: ${{new Date(invoice.createdAt).toLocaleDateString()}}</div>
                                <div class="doc-meta">Számlaszám: ${{invoice.invoiceNumber}}</div>
                            </div>
                            <div style="font-size: 1.25rem; font-weight: bold; color: #64748b;">SZÁMLA ELŐNÉZET</div>
                        </div>
                    `;
                    
                    let doctorTotal = 0;
                    for (const job of docJobs) {{
                        const groupedToothLines = groupToothLines(job.teeth);
                        const jobExtraLines = getJobExtraLines(job);
                        const lines = [...groupedToothLines, ...jobExtraLines].sort((a, b) => a.priority - b.priority);
                        
                        html += `
                        <div class="job-container">
                            <div class="job-header">
                                <span class="job-title">${{job.patientName}}</span>
                                <span style="font-size: 0.8rem; color: #64748b; font-family: monospace;">${{job.fileName}}</span>
                            </div>
                            <table>
                                <thead>
                                    <tr>
                                        <th style="width: 60%;">Leírás</th>
                                        <th style="width: 10%; text-align: center;">Menny.</th>
                                        <th style="width: 15%; text-align: right;">Egységár</th>
                                        <th style="width: 15%; text-align: right;">Összesen</th>
                                    </tr>
                                </thead>
                                <tbody>
                        `;
                        
                        let jobTotal = 0;
                        for (const line of lines) {{
                            const lineTotal = line.count * line.pricePerUnit;
                            jobTotal += lineTotal;
                            
                            html += `
                            <tr>
                                <td>
                                    <strong>${{line.kind === 'toothExtra' ? '+ ' + line.label : line.label}}</strong>
                                    ${{line.kind !== 'jobExtra' ? '<br/><span style="font-size: 0.75rem; color: #94a3b8;">Fogak: ' + line.units.sort((a,b)=>a-b).join(', ') + '</span>' : ''}}
                                </td>
                                <td style="text-align: center;">${{line.count}}</td>
                                <td style="text-align: right;">${{line.pricePerUnit.toLocaleString()}} ${{job.currency || 'HUF'}}</td>
                                <td style="text-align: right; font-weight: bold;">${{lineTotal.toLocaleString()}} ${{job.currency || 'HUF'}}</td>
                            </tr>
                            `;
                        }}
                        
                        doctorTotal += jobTotal;
                        
                        html += `
                                    <tr>
                                        <td colspan="3" style="text-align: right; font-weight: bold;">Munkalap összesen:</td>
                                        <td style="text-align: right; font-weight: bold; background-color: #f8fafc;">${{jobTotal.toLocaleString()}} ${{job.currency || 'HUF'}}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        `;
                    }}
                    
                    html += `
                        <div class="total-section">
                            <span>Végösszeg (${{doctorName}}): ${{doctorTotal.toLocaleString()}} ${{invoice.currency || 'HUF'}}</span>
                        </div>
                    </div>
                    `;
                }}
                
                html += `
                </body>
                </html>
                `;
                
                // Write HTML directly to document
                document.body.innerHTML = html;
                return {{ success: true }};
            }} catch(err) {{
                return {{ error: err.toString(), stack: err.stack }};
            }}
        }})()
        """
        
    return await evaluate_cdp(ws_url, js_code)

async def main_async():
    parser = argparse.ArgumentParser(description="PWA LLM Interface CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    # Subcommands
    subparsers.add_parser("fetch-jobs", help="Fetch all jobs from the PWA")
    subparsers.add_parser("fetch-invoices", help="Fetch all invoices")
    subparsers.add_parser("fetch-tariff-rules", help="Fetch all pricing rules")
    subparsers.add_parser("fetch-recognized-attributes", help="Fetch available materials, types, doctors, and patients")
    subparsers.add_parser("fetch-logs", help="Fetch all application log records")
    
    units_parser = subparsers.add_parser("fetch-units", help="Fetch teeth units for a specific job/project ID")
    units_parser.add_argument("project_id", help="The projectId or local ID of the target job")
    
    import_jobs_parser = subparsers.add_parser("job-import-json", help="Import jobs from a local JSON file")
    import_jobs_parser.add_argument("json_file", help="Path to local JSON file of jobs")
    
    import_rules_parser = subparsers.add_parser("tariff-rules-import-json", help="Validate and import tariff rules from a local JSON file")
    import_rules_parser.add_argument("json_file", help="Path to local JSON file of rules")
    
    save_state_parser = subparsers.add_parser("save-app-state", help="Serialize and save the entire IndexedDB to a JSON file")
    save_state_parser.add_argument("json_file", help="Path to write the database state JSON backup")
    
    load_state_parser = subparsers.add_parser("load-app-state", help="Wipe and restore the entire IndexedDB state from a JSON file")
    load_state_parser.add_argument("json_file", help="Path to read the database state JSON backup")
    
    create_tariff_parser = subparsers.add_parser("create-tariff", help="Create a new pricing tariff rule")
    create_tariff_parser.add_argument("rule_json", help="JSON string representing the tariff rule")
    
    create_job_parser = subparsers.add_parser("create-job", help="Create a new job and run the pricing engine")
    create_job_parser.add_argument("job_json", help="JSON string representing the job")
    
    create_invoice_parser = subparsers.add_parser("create-invoice", help="Create a new invoice and lock jobs under it")
    create_invoice_parser.add_argument("doctor_name", help="The name of the doctor receiving the invoice")
    create_invoice_parser.add_argument("job_ids", help="Comma-separated list of Job IDs to invoice")
    
    render_invoice_parser = subparsers.add_parser("render-invoice", help="Render an invoice to a vector PDF on host")
    render_invoice_parser.add_argument("invoice_id", help="ID of the invoice to render")
    render_invoice_parser.add_argument("pdf_path", help="Local file path to write the PDF output")
    
    # Pagination/limiting flags
    parser.add_argument("--limit", type=int, default=0, help="Limit list output count")
    parser.add_argument("--offset", type=int, default=0, help="List output offset")
    
    args = parser.parse_args()
    
    ws_url = get_chrome_ws_url()
    if not ws_url:
        print(json.dumps({
            "status": "error",
            "error": "Could not connect to Chrome debugging port 9222. Ensure Chrome is running."
        }, indent=2))
        sys.exit(1)
        
    start_time = time.time()
    
    # Construct args dictionary for execution
    kwargs = {}
    if args.command == "fetch-units":
        kwargs["project_id"] = args.project_id
    elif args.command in ["job-import-json", "tariff-rules-import-json", "save-app-state", "load-app-state"]:
        kwargs["json_file"] = args.json_file
    elif args.command == "create-tariff":
        kwargs["rule_json"] = args.rule_json
    elif args.command == "create-job":
        kwargs["job_json"] = args.job_json
    elif args.command == "create-invoice":
        kwargs["doctor_name"] = args.doctor_name
        # Split comma-separated job_ids
        kwargs["job_ids"] = [j.strip() for j in args.job_ids.split(",") if j.strip()]
    elif args.command == "render-invoice":
        kwargs["invoice_id"] = args.invoice_id
        
    response = await run_action(ws_url, args.command, **kwargs)
    
    # Handle printToPDF separate flow for render-invoice
    if args.command == "render-invoice" and response.get("status") == "success":
        # 1. Capture the printed PDF as base64 string from Chrome via CDP
        pdf_response = await print_to_pdf_cdp(ws_url)
        
        # 2. Revert/reload the browser tab so it returns back to standard React view
        await evaluate_cdp(ws_url, "window.location.reload()")
        
        if pdf_response["status"] == "success":
            try:
                # 3. Decode base64 and write the binary PDF output file on host
                pdf_bytes = base64.b64decode(pdf_response["data"])
                with open(args.pdf_path, 'wb') as f:
                    f.write(pdf_bytes)
                response = {
                    "status": "success",
                    "data": {
                        "success": True,
                        "message": f"Successfully rendered invoice '{args.invoice_id}' to vector PDF: '{args.pdf_path}'"
                    }
                }
            except Exception as e:
                response = {
                    "status": "error",
                    "error": f"Failed to write PDF file on host: {e}"
                }
        else:
            response = pdf_response
            
    execution_time_ms = int((time.time() - start_time) * 1000)
    
    if response["status"] == "success":
        # Write state to host file directly for save-app-state
        if args.command == "save-app-state":
            try:
                with open(args.json_file, 'w', encoding='utf-8') as f:
                    json.dump(response["data"], f, indent=2, ensure_ascii=False)
                data = {
                    "success": True,
                    "message": f"Successfully serialized entire IndexedDB database and saved to '{args.json_file}' on host disk."
                }
            except Exception as e:
                response["status"] = "error"
                response["error"] = f"Failed to write state file on host: {e}"
                data = None
        else:
            data = response["data"]
            
        if response["status"] == "success":
            # Apply offset/limit slicing to lists
            if isinstance(data, list):
                total_count = len(data)
                offset = args.offset
                limit = args.limit if args.limit > 0 else total_count
                sliced_data = data[offset:offset+limit]
                
                output = {
                    "status": "success",
                    "data": sliced_data,
                    "metadata": {
                        "total_items": total_count,
                        "limit_applied": args.limit,
                        "offset_applied": offset,
                        "execution_time_ms": execution_time_ms
                    }
                }
            else:
                output = {
                    "status": "success",
                    "data": data,
                    "metadata": {
                        "execution_time_ms": execution_time_ms
                    }
                }
        else:
            output = {
                "status": "error",
                "error": response.get("error", "Execution failed"),
                "metadata": {
                    "execution_time_ms": execution_time_ms
                }
            }
    else:
        output = {
            "status": "error",
            "error": response.get("error", "Execution failed"),
            "metadata": {
                "execution_time_ms": execution_time_ms
            }
        }
        
    print(json.dumps(output, indent=2, ensure_ascii=False))

def main():
    try:
        asyncio.run(main_async())
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    main()
