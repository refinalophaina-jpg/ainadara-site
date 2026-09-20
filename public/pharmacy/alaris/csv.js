// Data only: no formulas, SharePoint field markup, URLs or queries are executed.
export function csvRows(input) {
  let text=input.replace(/^\uFEFF/,''), field='', row=[], quoted=false, closed=false;
  const rows=[];
  if(text.startsWith('ListSchema=')) {
    const end=text.indexOf('\n');
    if(end<0)throw new Error('SharePoint export contains metadata but no CSV table.');
    text=text.slice(end+1);
  }
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted) {
      if(c==='"'&&text[i+1]==='"'){field+='"';i++;}
      else if(c==='"'){quoted=false;closed=true;}
      else field+=c;
    } else if(c==='"'&&!field&&!closed)quoted=true;
    else if(c===','||c==='\n'||c==='\r') {
      row.push(field);field='';closed=false;
      if(c!==','){if(row.some(v=>v.trim()))rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;}
    } else {
      if(closed||c==='"')throw new Error(`Malformed CSV quoting at character ${i+1}.`);
      field+=c;
    }
  }
  if(quoted)throw new Error('Unclosed CSV quote.');
  row.push(field);if(row.some(v=>v.trim()))rows.push(row);
  return rows;
}
export function csvRecords(text) {
  const rows=csvRows(text), headers=rows.shift()?.map(h=>h.trim());
  if(!headers?.length||new Set(headers).size!==headers.length)throw new Error('Missing or duplicate CSV column names.');
  return {headers,records:rows.map((values,i)=>{
    if(values.length!==headers.length)throw new Error(`Data record ${i+1}: expected ${headers.length} columns, found ${values.length}.`);
    return Object.fromEntries(headers.map((key,j)=>[key,values[j]]));
  })};
}
