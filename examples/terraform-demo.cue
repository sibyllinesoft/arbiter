// Terraform Infrastructure Demo
// #Terraform infrastructure file=main.tf

package terraform

// AWS Provider Configuration
#AWSProvider: {
	terraform: {
		required_providers: {
			aws: {
				source:  "hashicorp/aws"
				version: "~> 5.0"
			}
		}
	}
	
	provider: aws: {
		region: string | *"us-west-2"
	}
}

// VPC Resource
#VPC: {
	resource: aws_vpc: {
		main: {
			cidr_block:           "10.0.0.0/16"
			enable_dns_hostnames: true
			enable_dns_support:   true
			
			tags: {
				Name:        "main-vpc"
				Environment: string | *"production"
			}
		}
	}
}

// Internet Gateway
#InternetGateway: {
	resource: aws_internet_gateway: {
		main: {
			vpc_id: "${aws_vpc.main.id}"
			
			tags: {
				Name:        "main-igw"
				Environment: string | *"production"
			}
		}
	}
}

// Public Subnet
#PublicSubnet: {
	resource: aws_subnet: {
		public: {
			vpc_id:                     "${aws_vpc.main.id}"
			cidr_block:                 "10.0.1.0/24"
			availability_zone:          "us-west-2a"
			map_public_ip_on_launch:    true
			
			tags: {
				Name:        "public-subnet"
				Environment: string | *"production"
				Type:        "public"
			}
		}
	}
}

// Route Table
#RouteTable: {
	resource: aws_route_table: {
		public: {
			vpc_id: "${aws_vpc.main.id}"
			
			route: [{
				cidr_block: "0.0.0.0/0"
				gateway_id: "${aws_internet_gateway.main.id}"
			}]
			
			tags: {
				Name:        "public-route-table"
				Environment: string | *"production"
			}
		}
	}
}

// Route Table Association
#RouteTableAssociation: {
	resource: aws_route_table_association: {
		public: {
			subnet_id:      "${aws_subnet.public.id}"
			route_table_id: "${aws_route_table.public.id}"
		}
	}
}

// Security Group
#SecurityGroup: {
	resource: aws_security_group: {
		web: {
			name:        "web-security-group"
			description: "Security group for web servers"
			vpc_id:      "${aws_vpc.main.id}"
			
			ingress: [
				{
					description: "HTTP"
					from_port:   80
					to_port:     80
					protocol:    "tcp"
					cidr_blocks: ["0.0.0.0/0"]
				},
				{
					description: "HTTPS"
					from_port:   443
					to_port:     443
					protocol:    "tcp"
					cidr_blocks: ["0.0.0.0/0"]
				},
				{
					description: "SSH"
					from_port:   22
					to_port:     22
					protocol:    "tcp"
					cidr_blocks: ["10.0.0.0/16"]
				}
			]
			
			egress: [{
				from_port:   0
				to_port:     0
				protocol:    "-1"
				cidr_blocks: ["0.0.0.0/0"]
			}]
			
			tags: {
				Name:        "web-sg"
				Environment: string | *"production"
			}
		}
	}
}

// EC2 Instance
#WebServer: {
	resource: aws_instance: {
		web: {
			ami:                    "ami-0c02fb55956c7d316" // Amazon Linux 2
			instance_type:          "t3.micro"
			subnet_id:              "${aws_subnet.public.id}"
			vpc_security_group_ids: ["${aws_security_group.web.id}"]
			
			user_data: """
				#!/bin/bash
				yum update -y
				yum install -y httpd
				systemctl start httpd
				systemctl enable httpd
				echo "<h1>Hello from Terraform!</h1>" > /var/www/html/index.html
				"""
			
			tags: {
				Name:        "web-server"
				Environment: string | *"production"
			}
		}
	}
}

// Outputs
#Outputs: {
	output: {
		vpc_id: {
			description: "VPC ID"
			value:       "${aws_vpc.main.id}"
		}
		public_subnet_id: {
			description: "Public Subnet ID"
			value:       "${aws_subnet.public.id}"
		}
		web_server_public_ip: {
			description: "Public IP of the web server"
			value:       "${aws_instance.web.public_ip}"
		}
		web_server_dns: {
			description: "Public DNS of the web server"
			value:       "${aws_instance.web.public_dns}"
		}
	}
}

// Main infrastructure definition
infrastructure: {
	#AWSProvider
	#VPC
	#InternetGateway
	#PublicSubnet
	#RouteTable
	#RouteTableAssociation
	#SecurityGroup
	#WebServer
	#Outputs
}