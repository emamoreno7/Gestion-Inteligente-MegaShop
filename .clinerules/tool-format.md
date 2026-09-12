DO NOT output JSON blocks like {"name": "tool_name"}. DO NOT use <tool_name> <parameter_name> attribute format. You MUST strictly use Anthropic-style XML tags to invoke tools, with this exact format:

<read_file>
<path>path/to/file</path>
</read_file>

<write_to_file>
<path>path/to/file</path>
<content>file content here</content>
</write_to_file>

<list_files>
<path>path/to/directory</path>
<recursive>true</recursive>
</list_files>

<execute_command>
<command>your command here</command>
<requires_approval>true</requires_approval>
</execute_command>